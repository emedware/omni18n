export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

interface ClientDictionaryEntry {
	''?: string
	'.'?: OmnI18n.Zone
}
export type ClientDictionary = {
	[key: Exclude<string, keyof ClientDictionaryEntry>]: ClientDictionary
} & ClientDictionaryEntry

export interface OmnI18nClient {
	dictionary: ClientDictionary
	internals: Internals
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	locale: OmnI18n.Locale
	timeZone?: string
	interpolate(context: TContext, text: string, args: any[]): string
}

export interface TContext {
	key: string
	zones: string[]
	client: OmnI18nClient
}

export class TranslationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'translationError'
	}
}

export type Translator = ((...args: any[]) => string) & { [k: string]: Translator } & string
