/// <reference path="../types.d.ts" />

type CDic = OmnI18n.CondensedDictionary
type CDicE = CDic & string

/**
 * Abstract file used between the http layer and the database
 */

export function localeTree(locale: OmnI18n.Locale) {
	const parts = locale.split('-')
	return parts.map((_, i) => parts.slice(0, i + 1).join('-'))
}

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class I18nServer<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	constructor(protected db: OmnI18n.DB<KeyInfos, TextInfos>) {
		this.condense = this.condense.bind(this)
	}

	list(locale: OmnI18n.Locale, zone: string): Promise<OmnI18n.RawDictionary> {
		return this.db.list(['', ...localeTree(locale)], zone)
	}
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param locale
	 * @param zone
	 * @returns
	 */
	async condense(
		locale: OmnI18n.Locale,
		zones: OmnI18n.Zone[] = ['']
	): Promise<OmnI18n.CondensedDictionary[]> {
		const raws = await Promise.all(zones.map((zone) => this.list(locale, zone))),
			results: OmnI18n.CondensedDictionary[] = []
		for (const raw of raws) {
			const result: OmnI18n.CondensedDictionary = {}
			results.push(result)
			for (const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as string
				let current = result
				for (const k of keys) {
					if (!current[k]) current[k] = <CDicE>{}
					else if (typeof current[k] === 'string') current[k] = <CDicE>{ '': <string>current[k] }
					current = current[k] as CDic
				}
				if (current[lastKey] && typeof current[lastKey] !== 'string')
					(<CDic>current[lastKey])[''] = value
				else current[lastKey] = <CDicE>value
			}
		}
		return results
	}
}
