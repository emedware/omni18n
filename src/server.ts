/// <reference path="./geni18n.d.ts" />
/**
 * Abstract file used between the http layer and the database
 */

export interface DB {
	/**
	 * Modifies/add the value for the key [key, locale]
	 * @param key string key
	 * @param locale A language and perhaps a country
	 * @param value A text value
	 */
	modify(key: string, locale: Intl.UnicodeBCP47LocaleIdentifier, value: string): Promise<void>;
	/**
	 * Creates or deletes a key
	 * @param key The key to manipulate
	 * @param zone The zone to create the key in, or undefined to delete it
	 */
	create(key: string, zone: string): Promise<void>;
	/**
	 * Removes a key (and all its translations)
	 * @param key The key to remove
	 */
	remove(key: string): Promise<void>;
	/**
	 * Retrieves all the values for a certain locale 
	 * @param locale A language and perhaps a country
	 */
	list(locale: Intl.UnicodeBCP47LocaleIdentifier, zones: string[]): Promise<Geni18n.RawDictionary>;
}

// TODO zones

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class Server {
	constructor(private db: DB) {}
	// TODO: cache & return events
	/**
	 * Modifies the value for the key [key, locale]
	 * This function will among other things interact with the DB
	 * @param key string key
	 * @param locale A language and perhaps a country
	 * @param value A text value - if undefined, removes the entry
	 */
	async modify(key: string, locale: Intl.UnicodeBCP47LocaleIdentifier, value: string): Promise<void> {
		await this.db.modify(key, locale, value)
	}
	async create(key: string, zone: string, translations: Record<Intl.UnicodeBCP47LocaleIdentifier, string> = {}): Promise<void> {
		await this.db.create(key, zone)
		await Promise.all(Object.entries(translations).map(([locale, value]) => this.modify(key, locale, value)))
	}
	async remove(key: string): Promise<void> {
		await this.db.remove(key)
	}
	/**
	 * List entries directly from DB
	 * @param locale The exact locale to use
	 * @param zones The list of zones to retrieve
	 * @returns 
	 */
	private async list(locale: Intl.UnicodeBCP47LocaleIdentifier, zones: string[]): Promise<Record<string, string>> {
		return this.db.list(locale, zones);
	}
	
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param locale 
	 * @param zone 
	 * @returns 
	 */
	async condense(locale: Intl.UnicodeBCP47LocaleIdentifier, zones = ['']): Promise<Geni18n.CondensedDictionary> {
		const parts = locale.split('-'),
			raws = await Promise.all(parts.map((_, i) => this.list(parts.slice(0, i + 1).join('-'), zones))),
			result: Geni18n.CondensedDictionary = {}
		for(const raw of raws) {
			for(const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as string
				let current = result
				for(const k of keys) {
					if(!current[k]) current[k] = {}
					else if(typeof current[k] === 'string') current[k] = { '': current[k] }
					current = current[k] as Geni18n.CondensedDictionary
				}
				if(current[lastKey] && typeof current[lastKey] !== 'string')
					current[lastKey][''] = value
				else current[lastKey] = value
			}
		}
		return result
	}
}