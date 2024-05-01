import {
	type CondensedDictionary,
	type Condense,
	type InteractiveDB,
	type Locale,
	type OnModification,
	type RawDictionary,
	type TextKey,
	type Translation,
	type Zone,
	WorkDictionary
} from '../types'
/**
 * i18n consumption/usage, both client and server side.
 */
import '../polyfill'
import Defer from '../defer'
import {
	ClientDictionary,
	contextKey,
	OmnI18nClient,
	Internals,
	TContext as RootContext,
	text,
	zone,
	fallback,
	Translatable,
	Translator
} from './types'
import { interpolate } from './interpolation'
import { longKeyList, parseInternals, recurExtend, reports, translate, translator } from './helpers'

export type TContext = RootContext<I18nClient>

export default class I18nClient implements OmnI18nClient {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	internals: Internals = {}
	dictionary: ClientDictionary = {}
	protected loadedZones = new Set<Zone>()
	private toLoadZones = new Set<Zone>()
	private loadDefer = new Defer()

	public timeZone?: string
	public currency?: string

	/**
	 *
	 * @param locales A list of locales: from preferred to fallback
	 * @param condense A function that will query the server for the condensed dictionary
	 * @param onModification A function that will be called when the dictionary is modified
	 * @example new I18nClient(['fr', 'en'], server.condense, frontend.refreshTexts)
	 */
	constructor(
		public locales: Locale[],
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condense: Condense,
		public onModification?: OnModification
	) {
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
			await this.loadDefer.defer(async () => {
				const toLoad = this.toLoadZones
				this.toLoadZones = new Set()
				await this.download(Array.from(toLoad))
			})
		}
		return translator({ client: this, zones, key: '' })
	}

	protected received(zones: Zone[], condensed: CondensedDictionary[]) {
		for (let i = 0; i < zones.length; i++) {
			this.loadedZones.add(zones[i])
			recurExtend(this.dictionary, condensed[i], zones[i])
		}
		if (zones.includes('') && this.dictionary.internals)
			this.internals = parseInternals(this.dictionary.internals)

		this.onModification?.(condensed.map(longKeyList).flat())
	}

	private async download(zones: Zone[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.has(zone))
		if (toLoad.length) this.received(toLoad, await this.condense(this.locales, toLoad))
	}

	async setLocale(locales: Locale[]) {
		if (this.locales.every((locale, i) => locale == locales[1])) return
		this.locales = locales
		const toLoad = Array.from(this.loadedZones)
		this.loadedZones = new Set()
		this.dictionary = {}
		this.internals = {}
		await this.download(toLoad)
	}

	modified(entries: Record<TextKey, [Translation, Zone] | undefined>) {
		for (const [key, value] of Object.entries(entries)) {
			const keys = key.split('.'),
				lastKey = keys.pop() as TextKey
			let browser = this.dictionary
			for (const key of keys) {
				if (!browser[key]) browser[key] = {}
				browser = browser[key]
			}
			if (value)
				browser[lastKey] = <ClientDictionary>{
					...browser[lastKey],
					[text]: value[0],
					[zone]: value[1]
				}
			else if (browser[lastKey]) {
				delete browser[lastKey][text]
				delete browser[lastKey][zone]
				if (!Object.keys(browser[lastKey]).length) delete browser[lastKey]
			}
		}
		this.onModification?.(Object.keys(entries))
	}

	interpolate: (context: TContext, text: Translation, args: any[]) => string = interpolate
}

export function getContext(translator: Translator): TContext {
	return translator[contextKey] as TContext
}
