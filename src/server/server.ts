/// <reference path="../types.d.ts" />

type CDic = OmnI18n.CondensedDictionary
type CDicE = CDic & OmnI18n.Translation

/**
 * Abstract file used between the http layer and the database
 */

export function localeTree(locale: OmnI18n.Locale) {
	const parts = locale.split('-')
	const rv = []
	for (let i = parts.length; i > 0; i--) rv.push(parts.slice(0, i).join('-'))
	return rv
}

// Remove duplicates while keeping the order
function removeDup(arr: string[]) {
	const done = new Set<string>()
	return arr.filter((k) => !done.has(k) && done.add(k))
}

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class I18nServer<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	constructor(protected db: OmnI18n.DB) {
		this.condense = this.condense.bind(this)
	}

	private list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone): Promise<OmnI18n.RawDictionary> {
		const [primary, ...fallbacks] = locales
		return this.db.list(
			removeDup([...localeTree(primary), '', ...fallbacks.map(localeTree).flat()]),
			zone
		)
	}
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param locales List of locales in order of preference - later locales are only used if the previous ones had no traduction for a key.
	 * @param zones List of zones to condense.
	 * @returns
	 */
	async condense(
		locales: OmnI18n.Locale[],
		zones: OmnI18n.Zone[] = ['']
	): Promise<OmnI18n.CondensedDictionary[]> {
		const raws = await Promise.all(zones.map((zone) => this.list(locales, zone))),
			results: OmnI18n.CondensedDictionary[] = []
		for (const raw of raws) {
			const result: OmnI18n.CondensedDictionary = {}
			results.push(result)
			for (const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as OmnI18n.TextKey
				let current = result,
					hasValue = false // Do we have a value who is not a fall back with a shorter key?
				for (const k of keys) {
					if (!(k in current)) current[k] = <CDicE>{}
					else if (typeof current[k] === 'string')
						current[k] = <CDicE>{ '': <OmnI18n.Translation>current[k] }
					const next = current[k] as CDic
					if ('' in next && !('.' in next)) hasValue = true
					current = next
				}
				//'fr-CA' begins with 'fr-CA', 'fr' and '' but not 'en'
				const fallback = !locales[0].startsWith(value[0]),
					clk = current[lastKey]
				if (!hasValue || !fallback) {
					if (fallback)
						current[lastKey] = <CDicE>{
							...(typeof clk === 'object' ? clk : {}),
							'': value[1],
							'.': '.'
						}
					else if (clk && typeof clk !== 'string') (<CDic>current[lastKey])[''] = value[1]
					else current[lastKey] = <CDicE>value[1]
				}
			}
		}
		return results
	}

	static specs2url = (locales: OmnI18n.Locale[], zones: OmnI18n.Zone[]) => ({
		locales: `${encodeURIComponent(locales.join('€'))}`,
		zones: `${encodeURIComponent(zones.join('€'))}`
	})
	static url2specs = (locales: string, zones: string) => ({
		locales: locales.split('€'),
		zones: zones.split('€')
	})
}
