/// <reference path="../geni18n.d.ts" />

type CDic = GenI18n.CondensedDictionary
type CDicE = CDic & string

/**
 * Abstract file used between the http layer and the database
 */

export function localeTree(locale: GenI18n.Locale) {
	const parts = locale.split('-')
	return parts.map((_, i) => parts.slice(0, i + 1).join('-'))
}

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class I18nServer<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	constructor(protected db: GenI18n.DB<KeyInfos, TextInfos>) {
		this.condense = this.condense.bind(this)
	}

	list(locale: GenI18n.Locale, zone: string): Promise<GenI18n.RawDictionary> {
		return this.db.list(['', ...localeTree(locale)], zone)
	}
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param locale
	 * @param zone
	 * @returns
	 */
	async condense(
		locale: GenI18n.Locale,
		zones: GenI18n.Zone[] = ['']
	): Promise<GenI18n.CondensedDictionary[]> {
		const raws = await Promise.all(zones.map((zone) => this.list(locale, zone))),
			results: GenI18n.CondensedDictionary[] = []
		for (const raw of raws) {
			const result: GenI18n.CondensedDictionary = {}
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
