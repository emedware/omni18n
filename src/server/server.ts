import {
	DB,
	type CondensedDictionary,
	type Locale,
	type RawDictionary,
	type TextKey,
	type Translation,
	type Zone
} from '../types'

type CDic = CondensedDictionary
type CDicE = CDic & Translation

/**
 * Abstract file used between the http layer and the database
 */

export function localeTree(locale: Locale) {
	const parts = locale.split('-')
	let cumulated = parts.shift() as string
	const rv = [cumulated]
	while (parts.length) rv.unshift((cumulated += '-' + parts.shift()))
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
	constructor(protected db: DB) {
		this.condense = this.condense.bind(this)
	}

	private list(locales: Locale[], zone: Zone): Promise<RawDictionary> {
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
	async condense(locales: Locale[], zones: Zone[] = ['']): Promise<CondensedDictionary[]> {
		const raws = await Promise.all(zones.map((zone) => this.list(locales, zone))),
			results: CondensedDictionary[] = []
		for (const raw of raws) {
			const result: CondensedDictionary = {}
			results.push(result)
			for (const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as TextKey
				let current = result,
					hasValue = false // Do we have a value who is not a fall back with a shorter key?
				for (const k of keys) {
					if (!(k in current)) current[k] = <CDicE>{}
					else if (typeof current[k] === 'string')
						current[k] = <CDicE>{ '': <Translation>current[k] }
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
}

export const specs2url = (locales: Locale[], zones: Zone[]) => ({
	locales: `${encodeURIComponent(locales.join('€'))}`,
	zones: `${encodeURIComponent(zones.join('€'))}`
})
export const url2specs = (locales: string, zones: string) => ({
	locales: locales.split('€'),
	zones: zones.split('€')
})
