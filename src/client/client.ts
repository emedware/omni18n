import {
	type Condense,
	type CondensedDictionary,
	type Locale,
	type OnModification,
	type TextKey,
	type Translation,
	type Zone
} from '../types'
/**
 * i18n consumption/usage, both client and server side.
 */
import Defer from '../defer'
import '../polyfill'
import {
	longKeyList,
	mergeCondensed,
	parseInternals,
	recurExtend,
	reports,
	translator
} from './helpers'
import { interpolate } from './interpolation'
import {
	ClientDictionary,
	Internals,
	OmnI18nClient,
	TContext as RootContext,
	Translator,
	contextKey,
	text
} from './types'

export type TContext = RootContext<I18nClient>
export type PartialLoad = [Zone[], CondensedDictionary]

export function removeDuplicates(arr: Locale[]) {
	const done = new Set<Locale>()
	return arr.filter((k) => !done.has(k) && done.add(k))
}

export default class I18nClient implements OmnI18nClient {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	internals: Internals = {}
	dictionary: ClientDictionary = {}
	protected loadedZones = new Set<Zone>()
	private toLoadZones = new Set<Zone>()
	private loadDefer = new Defer(async () => {
		const toLoad = this.toLoadZones
		this.toLoadZones = new Set()
		await this.download(Array.from(toLoad))
	})

	public locales: Locale[]
	public timeZone?: string
	public currency?: string

	private partialLoads: Record<Zone, CondensedDictionary> = {}

	/**
	 *
	 * @param locales A list of locales: from preferred to fallback
	 * @param condense A function that will query the server for the condensed dictionary
	 * @param onModification A function that will be called when the dictionary is modified
	 * @example new I18nClient(['fr', 'en'], server.condense, frontend.refreshTexts)
	 */
	constructor(
		locales: Locale[],
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condense: Condense,
		public onModification?: OnModification
	) {
		this.locales = removeDuplicates(locales)
		this.ordinalRules = new Intl.PluralRules(locales[0], { type: 'ordinal' })
		this.cardinalRules = new Intl.PluralRules(locales[0], { type: 'cardinal' })
	}

	/**
	 * This should be called for each user-control, page, ...
	 * If zoning per user role, the call can specify no zone and the zone can be specified on main page-load or user change
	 * If zoning per user-control/page, the call should specify the zone (path separated by '.')
	 * @param zones Zones entered
	 * @returns The translator
	 */
	public async enter(...zones: Zone[]) {
		if (!zones.includes('')) zones.push('')
		const knownZones = this.loadedZones.union(this.toLoadZones),
			toAdd = zones.filter((zone) => !knownZones.has(zone))
		if (toAdd.length) {
			for (const t of toAdd) this.toLoadZones.add(t)
			await this.loadDefer.defer()
		} else await this.loadDefer.promise
		return translator({ client: this, key: '' })
	}

	public getPartialLoad(excludedZones: Zone[] = []): PartialLoad {
		let rv: CondensedDictionary = {},
			zones: Zone[] = []

		for (const zone in this.partialLoads)
			if (!excludedZones.includes(zone)) {
				zones.push(zone)
				rv = mergeCondensed(rv, this.partialLoads[zone])
			}

		return [zones, rv]
	}

	public usePartial([zones, condensed]: PartialLoad) {
		zones.map((zone) => this.loadedZones.add(zone))
		recurExtend(this.dictionary, condensed)
		if (zones.includes('') && this.dictionary.internals)
			this.internals = parseInternals(this.dictionary.internals)

		this.onModification?.(longKeyList(condensed))
	}

	protected received(zones: Zone[], condensed: CondensedDictionary[]) {
		let wholeCondensed = {}
		for (let i = 0; i < zones.length; i++) {
			this.partialLoads[zones[i]] = condensed[i]
			wholeCondensed = mergeCondensed(wholeCondensed, condensed[i])
		}

		this.usePartial([zones, wholeCondensed])
	}

	private async download(zones: Zone[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.has(zone))
		if (toLoad.length) this.received(toLoad, await this.condense(this.locales, toLoad))
	}

	setLocales(locales: Locale[], partial?: PartialLoad) {
		locales = removeDuplicates(locales)
		if (
			this.locales.length === locales.length &&
			this.locales.every((locale, i) => locale == locales[i])
		)
			return
		this.locales = locales
		this.toLoadZones = this.loadedZones
		this.loadedZones = new Set()
		this.dictionary = {}
		this.internals = {}
		this.loadDefer.defer()
	}

	modified(entries: Record<TextKey, Translation | undefined>) {
		for (const [key, value] of Object.entries(entries)) {
			const keys = key.split('.'),
				lastKey = keys.pop() as TextKey
			let browser = this.dictionary
			for (const key of keys) {
				if (!browser[key]) browser[key] = {}
				browser = browser[key]
			}
			if (value !== undefined)
				browser[lastKey] = <ClientDictionary>{
					...browser[lastKey],
					[text]: value
				}
			else if (browser[lastKey]) {
				delete browser[lastKey][text]
				if (!Object.keys(browser[lastKey]).length) delete browser[lastKey]
			}
		}
		this.onModification?.(Object.keys(entries))
	}

	interpolate(key: TextKey, text: Translation, ...args: any[]) {
		return interpolate({ client: this, key }, text, args)
	}

	missing(key: string, fallback?: Translation): string {
		return reports.missing({ key, client: this }, fallback)
	}
	error(key: string, error: string, spec: object): string {
		return reports.error({ key, client: this }, error, spec)
	}
}

export function getContext(translator: Translator): TContext {
	return translator[contextKey] as TContext
}
