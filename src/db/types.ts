import { Locale, TextKey, Translation, WorkDictionary, Zone } from '../types'

/**
 * Dictionary used between the server and the DB
 * key => [locale, text]
 */
export type RawDictionary = Record<TextKey, [Locale, Translation]>

export interface DB {
	/**
	 * Retrieves all the values for a certain zone and certain locales
	 * @param locales A list of locales to search for
	 * @param zone The zone to search in
	 * @returns A dictionary of key => [locale, text], where locale is the first on the list that has a translation
	 */
	list(locales: Locale[], zone: Zone): Promise<RawDictionary>
}

/**
 * Because a request retrieving "the first locale from a given list" might get really complex with some engines
 * So, instead of implementing `DB` directly, `SimplifiedDB` can be extended by providing a `listLocale` function
 *
 * The list function will simply retrieve all the zone/locale keys/text and sort them programmatically
 */
export abstract class SimplifiedQueryDB implements DB {
	/**
	 * Retrieves all the values for a certain zone and a certain locales
	 * @param locale The locale to search for
	 * @param zone The zone to search in
	 * @returns A dictionary of key => text
	 */
	abstract listLocale(locales: Locale, zone: Zone): Promise<[TextKey, Translation][]>
	async list(locales: Locale[], zone: Zone) {
		const rv: RawDictionary = {}
		for (const locale of locales.reverse())
			for (const [key, text] of await this.listLocale(locale, zone)) rv[key] = [locale, text]
		return rv
	}
}

// TODO? A caching class

export interface TranslatableDB<TextInfos extends {} = {}> extends DB {
	/**
	 * Retrieves all the values for certain locales, in order for translators to work on it
	 * @param locales
	 */
	workList(locales: Locale[]): Promise<WorkDictionary>

	/**
	 * Modifies/add the value for the key [key, locale]
	 * Note: checks that the key exists
	 * @param key text key
	 * @param locale A language and perhaps a country
	 * @param text A text value
	 * @returns The zone where the key is stored or false if no change were brought
	 */
	modify(
		key: TextKey,
		locale: Locale,
		text: Translation | undefined,
		textInfos?: Partial<TextInfos>
	): Promise<void>
}

export interface EditableDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	extends TranslatableDB<TextInfos> {
	/**
	 * Creates or modifies a key
	 * @param key The key to manipulate
	 * @param zone The zone to create the key in, or undefined to delete it
	 * @returns Wether the zone was changed
	 */
	key(key: TextKey, zone: Zone, keyInfos?: Partial<KeyInfos>): Promise<boolean>

	/**
	 * Renames a key - or removes it (and its translation) if newKey is undefined
	 * @param key
	 * @param newKey
	 * @returns All the information about that key (actually useful on deletion)
	 */
	reKey(key: TextKey, newKey?: TextKey): Promise<{ zone: Zone; texts: Record<Locale, Translation> }>
}

export interface InteractiveDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	extends EditableDB<KeyInfos, TextInfos> {
	/**
	 * Retrieves all the translations given for a certain key
	 * @param key The key to search for
	 */
	get(key: TextKey): Promise<Record<Locale, Translation>>

	/**
	 * Checks if a key is specified in a certain locale
	 * @param key The key to search for
	 * @param locales The locales to search in
	 */
	getZone(key: TextKey, locales?: Locale[]): Promise<Zone | false>
}
