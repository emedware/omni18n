declare namespace GenI18n {
	type CondensedDictionary = {
		[key: Exclude<string, ''>]: CondensedDictionary | string
		''?: string
	}

	type Condense = (locale: GenI18n.LocaleName, zones: Zone[]) => Promise<CondensedDictionary[]>
	type OnModification = (entries?: GenI18n.LocaleName[]) => void
	type RawDictionary = Record<string, string>

	// shortcut
	type LocaleName = Intl.UnicodeBCP47LocaleIdentifier

	type Zone = string

	interface DB<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
		/**
		 * Retrieves all the values for a certain locale
		 * @param locale A language and perhaps a country
		 */
		list(locales: GenI18n.LocaleName[], zone: Zone): Promise<GenI18n.RawDictionary>

		/**
		 * Retrieves all the locales given for a certain key
		 * @param key The key to search for
		 */
		get(key: string): Promise<Record<GenI18n.LocaleName, string>>
	}

	interface InteractiveDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
		extends DB<KeyInfos, TextInfos> {
		/**
		 * Checks if a key is specified in a certain locale
		 * @param key The key to search for
		 * @param locales The locales to search in
		 */
		isSpecified(key: string, locales: GenI18n.LocaleName[]): Promise<undefined | {} | TextInfos>

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
			locale: GenI18n.LocaleName,
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
		 * Removes a key (and all its translations)
		 * @param key The key to remove
		 * @returns The zone where the key was stored and the locales where it was translated
		 */
		remove(key: string): Promise<{ zone: string; locales: GenI18n.LocaleName[] }>
	}
}
