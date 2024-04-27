/// <reference path="../omni18n.d.ts" />
/**
 * i18n consumption/usage, both client and server side.
 */
import '../polyfill'
import Defer from '../defer'
import { ClientDictionary, OmnI18nClient, Internals } from './types'
import { interpolate } from './interpolation'
import { longKeyList, parseInternals, recurExtend, translator } from './helpers'

export default class I18nClient implements OmnI18nClient {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	internals: Internals = {}
	dictionary: ClientDictionary = {}
	protected loadedZones = new Set<OmnI18n.Zone>()
	private toLoadZones = new Set<OmnI18n.Zone>()
	private loadDefer = new Defer()

	public loaded: Promise<void> = Promise.resolve()

	public timeZone?: string

	constructor(
		public locale: OmnI18n.Locale,
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condense: OmnI18n.Condense,
		public onModification?: OmnI18n.OnModification
	) {
		this.ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' })
		this.cardinalRules = new Intl.PluralRules(locale, { type: 'cardinal' })
	}

	get loading() {
		return this.loadDefer.deferring
	}

	/**
	 * This should be called for each user-control, page, ...
	 * If zoning per user role, the call can specify no zone and the zone can be specified on main page-load or user change
	 * If zoning per user-control/page, the call should specify the zone (path separated by '.')
	 * @param zones Zones entered
	 * @returns The translator
	 */
	public enter(...zones: string[]) {
		if (!zones.length) zones.push('')
		const knownZones = this.loadedZones.union(this.toLoadZones),
			toAdd = zones.filter((zone) => !knownZones.has(zone))
		if (toAdd.length) {
			for (const t of toAdd) this.toLoadZones.add(t)
			this.loaded = this.loadDefer.defer(async () => {
				const toLoad = this.toLoadZones
				this.toLoadZones = new Set()
				await this.download(Array.from(toLoad))
			})
		}
		return translator({ client: this, zones, key: '' })
	}

	protected received(zones: string[], condensed: OmnI18n.CondensedDictionary[]) {
		for (let i = 0; i < zones.length; i++) {
			this.loadedZones.add(zones[i])
			recurExtend(this.dictionary, condensed[i], zones[i])
		}
		if (zones.includes('') && this.dictionary.internals)
			this.internals = parseInternals(this.dictionary.internals)

		this.onModification?.(condensed.map(longKeyList).flat())
	}

	private async download(zones: string[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.has(zone))
		if (toLoad.length) this.received(toLoad, await this.condense(this.locale, toLoad))
	}

	async setLocale(locale: OmnI18n.Locale) {
		if (this.locale === locale) return
		this.locale = locale
		const toLoad = Array.from(this.loadedZones)
		this.loadedZones = new Set()
		this.dictionary = {}
		this.internals = {}
		await this.download(toLoad)
	}

	modified(entries: Record<string, [string, string] | undefined>) {
		for (const [key, value] of Object.entries(entries)) {
			const keys = key.split('.'),
				lastKey = keys.pop() as string
			let browser = this.dictionary
			for (const key of keys) {
				if (!browser[key]) browser[key] = {}
				browser = browser[key]
			}
			if (value)
				browser[lastKey] = <ClientDictionary>{
					...browser[lastKey],
					'': value[0],
					'.': value[1]
				}
			else if (browser[lastKey]) {
				delete browser[lastKey]['']
				delete browser[lastKey]['.']
				if (!Object.keys(browser[lastKey]).length) delete browser[lastKey]
			}
		}
		this.onModification?.(Object.keys(entries))
	}

	interpolate = interpolate
}
