// shortcuts, it's just strings at the end of the day, it helps copilot/codeium
export type Locale = Intl.UnicodeBCP47LocaleIdentifier
export type Zone = string
// No `then` as it would become `thenable` and no async function could return a `Translator`
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
export type WorkDictionaryText<TextInfos extends {} = {}> = {
	text?: Translation
	infos?: TextInfos
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
