// shortcuts, it's just strings at the end of the day, it helps copilot/codeium
export type Locale = Intl.UnicodeBCP47LocaleIdentifier
export type Zone = string
export type TextKey = Exclude<string, '' | '.' | 'then' | '.zone' | '.textInfos' | '.keyInfos'>
export type Translation = string

export type CondensedDictionary = {
	[key: TextKey]: CondensedDictionary | Translation
} & {
	''?: Translation
	'.'?: '.' // fallback marker
}

export type Condense = (locales: Locale[], zones: Zone[]) => Promise<CondensedDictionary[]>
export type OnModification = (keys?: TextKey[]) => void
/**
 * Dictionary used between the server and the DB
 * key => [locale, text]
 */
export type RawDictionary = Record<TextKey, [Locale, Translation]>
export type WorkDictionaryText<TextInfos extends {} = {}> = {
	text: Translation
	infos: TextInfos
}
export type WorkDictionaryEntry<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	texts: { [locale: Locale]: WorkDictionaryText<TextInfos> }
	zone: Zone
	infos?: KeyInfos
}
/**
 * Dictionary used for translator-related operations
 */
export type WorkDictionary = Record<TextKey, WorkDictionaryEntry>

export interface DB {
	/**
	 * Retrieves all the values for a certain zone
	 * @param locales A list of locales to search for
	 * @param zone The zone to search in
	 * @returns A dictionary of key => [locale, text], where locale is the first on the list that has a translation
	 */
	list(locales: Locale[], zone: Zone): Promise<RawDictionary>
}

export interface InteractiveDB<KeyInfos extends {} = {}, TextInfos extends {} = {}> extends DB {
	/**
	 * Retrieves all the values for certain locales, in order for translators to work on it
	 * @param locales
	 */
	workList(locales: Locale[]): Promise<WorkDictionary>

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
		text: Translation,
		textInfos?: Partial<TextInfos>
	): Promise<Zone | false>

	/**
	 * Creates or modifies a key
	 * @param key The key to manipulate
	 * @param zone The zone to create the key in, or undefined to delete it
	 * @returns Wether there was a change
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
