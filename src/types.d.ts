declare namespace OmnI18n {
	// shortcuts, it's just a string at the end of the day, it helps copilot
	type Locale = Intl.UnicodeBCP47LocaleIdentifier
	type Zone = string

	type CondensedDictionary = {
		[key: Exclude<string, '' | '.'>]: CondensedDictionary | string
		''?: string
		'.'?: '.' // fallback marker
	}

	type Condense = (locales: Locale[], zones: Zone[]) => Promise<CondensedDictionary[]>
	type OnModification = (keys?: string[]) => void
	/**
	 * Dictionary used between the server and the DB
	 * key => [locale, text]
	 */
	type RawDictionary = Record<string, [string, string]>
	type WorkDictionaryText<TextInfos extends {} = {}> = {
		text: string
		infos: TextInfos
	}
	type WorkDictionaryEntry<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
		locales: { [locale: OmnI18n.Locale]: WorkDictionaryText<TextInfos> }
		zone: Zone
		infos: KeyInfos
	}
	/**
	 * Dictionary used for translator-related operations
	 */
	type WorkDictionary = Record<string, WorkDictionaryEntry>

	interface DB {
		/**
		 * Retrieves all the values for a certain zone
		 * @param locales A list of locales to search for
		 * @param zone The zone to search in
		 * @returns A dictionary of key => [locale, text], where locale is the first on the list that has a translation
		 */
		list(locales: Locale[], zone: Zone): Promise<RawDictionary>
	}

	interface InteractiveDB<KeyInfos extends {} = {}, TextInfos extends {} = {}> extends DB {
		/**
		 * Retrieves all the values for certain locales, in order for translators to work on it
		 * @param locales
		 */
		workList(locales: Locale[]): Promise<WorkDictionary>

		/**
		 * Retrieves all the locales given for a certain key
		 * @param key The key to search for
		 */
		get(key: string): Promise<Record<Locale, string>>

		/**
		 * Checks if a key is specified in a certain locale
		 * @param key The key to search for
		 * @param locales The locales to search in
		 */
		isSpecified(key: string, locales: Locale[]): Promise<undefined | {} | TextInfos>

		/**
		 * Modifies/add the value for the key [key, locale]
		 * Note: checks that the key exists
		 * @param key string key
		 * @param locale A language and perhaps a country
		 * @param text A text value
		 * @returns The zone where the key is stored or false if no change were brought
		 */
		modify(
			key: string,
			locale: Locale,
			text: string,
			textInfos?: Partial<TextInfos>
		): Promise<string | false>

		/**
		 * Creates or modifies a key
		 * @param key The key to manipulate
		 * @param zone The zone to create the key in, or undefined to delete it
		 * @returns Wether there was a change
		 */
		key(key: string, zone: string, keyInfos?: Partial<KeyInfos>): Promise<boolean>

		/**
		 * Renames a key - or removes it (and its translation) if newKey is undefined
		 * @param key
		 * @param newKey
		 * @returns The zone where the key was stored and the locales where it was translated
		 */
		reKey(key: string, newKey?: string): Promise<{ zone: string; locales: Locale[] }>
	}
}
