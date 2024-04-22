import { CondensedDictionary } from "./common";

interface RawEntry {
	text: string
	zone: string
}

export type RawDictionary = Record<string, RawEntry>

export interface DB {
	/**
	 * Modifies/removes the value for the key [key, dialect]
	 * @param key string key
	 * @param dialect A language and perhaps a country
	 * @param value A text value - if undefined, removes the entry
	 */
	modify(key: string, dialect: Intl.UnicodeBCP47LocaleIdentifier, value?: string): Promise<void>;
	/**
	 * Retrieves all the values for a certain dialect 
	 * @param dialect A language and perhaps a country
	 */
	list(dialect: Intl.UnicodeBCP47LocaleIdentifier): Promise<RawDictionary>;
}

// TODO zones

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class Server {
	private dialectCache: Record<string, RawDictionary> = {}
	constructor(private db: DB) {}
	// TODO: cache & return events
	/**
	 * Modifies the value for the key [key, dialect]
	 * This function will among other things interact with the DB
	 * @param key string key
	 * @param dialect A language and perhaps a country
	 * @param value A text value - if undefined, removes the entry
	 */
	async modify(key: string, dialect: Intl.UnicodeBCP47LocaleIdentifier, value?: string): Promise<void> {
		await this.db.modify(key, dialect, value)
	}
	private async list(dialect: Intl.UnicodeBCP47LocaleIdentifier, zone: string): Promise<Record<string, string>> {
		if(!this.dialectCache[dialect]) this.dialectCache[dialect] = await this.db.list(dialect);
		return Object.fromEntries(
			Object.entries(this.dialectCache[dialect])
				.filter(([_, entry]) => !entry.zone || entry.zone === zone || zone.startsWith(`${entry.zone}.`))
				.map(([key, entry]) => [key, entry.text])
		)
	}
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param dialect 
	 * @param zone 
	 * @returns 
	 */
	async condense(dialect: Intl.UnicodeBCP47LocaleIdentifier, zone = ''): Promise<CondensedDictionary> {
		const parts = dialect.split('-'),
			raws = await Promise.all(parts.map((_, i) => this.list(parts.slice(0, i + 1).join('-'), zone))),
			result: CondensedDictionary = {}
		for(const raw of raws) {
			for(const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as string
				let current = result
				for(const k of keys) {
					if(!current[k]) current[k] = {}
					else if(typeof current[k] === 'string') current[k] = { '': current[k] }
					current = current[k] as CondensedDictionary
				}
				if(current[lastKey] && typeof current[lastKey] !== 'string')
					current[lastKey][''] = value
				else current[lastKey] = value
			}
		}
		return result
	}
}