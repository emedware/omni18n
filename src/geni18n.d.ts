declare namespace GenI18n {
	interface CondensedDictionary {
		[key: Exclude<string, ''>]: CondensedDictionary & string
		''?: string
	}

	type RawDictionary = Record<string, string>

	// shortcut
	type LocaleName = Intl.UnicodeBCP47LocaleIdentifier

	type Zone = string
}
