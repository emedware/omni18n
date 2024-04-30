/// <reference path="../types.d.ts" />

type CDic = OmnI18n.CondensedDictionary
type CDicE = CDic & string

/**
 * Abstract file used between the http layer and the database
 */

export function localeTree(locale: OmnI18n.Locale) {
	const parts = locale.split('-')
	const rv = []
	for (let i = parts.length; i > 0; i--) rv.push(parts.slice(0, i).join('-'))
	return rv
}

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class I18nServer<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	constructor(protected db: OmnI18n.DB) {
		this.condense = this.condense.bind(this)
	}

	list(locales: OmnI18n.Locale[], zone: string): Promise<OmnI18n.RawDictionary> {
		const [primary, ...fallbacks] = locales
		return this.db.list([...localeTree(primary), '', ...fallbacks.map(localeTree).flat()], zone)
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
			let hasValue = false
			results.push(result)
			for (const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as string
				let current = result
				for (const k of keys) {
					if (!(k in current)) current[k] = <CDicE>{}
					else if (typeof current[k] === 'string') current[k] = <CDicE>{ '': <string>current[k] }
					current = current[k] as CDic
				}
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
					hasValue = true
				}
			}
		} /*
		for (const fallback of fallbacks) {
			const raws = await Promise.all(zones.map((zone) => this.list(fallback, zone)))
			for (let i = 0; i < raws.length; i++) {
				const raw = raws[i],
					result = results[i]
				for (const key in raw) {
					const value = raw[key],
						keys = key.split('.'),
						lastKey = keys.pop() as string
					let current: OmnI18n.CondensedDictionary | null = result
					for (const k of keys) {
						if (!(k in current)) current![k] = <CDicE>{}
						else if (
							typeof current[k] === 'string' ||
							(<OmnI18n.CondensedDictionary>current[k])['']
						) {
							current = null
							break
						}
						current = current[k] as CDic
					}
					if (current && (!current[lastKey] || typeof current[lastKey] === 'string'))
						current[lastKey] = <CDicE>value
				}
			}
		}*/
		return results
	}
}
