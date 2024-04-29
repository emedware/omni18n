export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

export const zone = Symbol('Zone'),
	text = Symbol('Text')

export type ClientDictionary = {
	[key: string]: ClientDictionary
	[zone]?: string
	[text]?: OmnI18n.Zone
}

export interface OmnI18nClient {
	dictionary: ClientDictionary
	internals: Internals
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	locales: OmnI18n.Locale[]
	timeZone?: string
	interpolate(context: TContext, text: string, args: any[]): string
	readonly loading: boolean
}

export interface TContext {
	key: string
	zones: string[]
	client: OmnI18nClient
}

export class TranslationError extends Error {
	name = 'TranslationError'
}

export type Translator = ((...args: any[]) => string) & { [k: string]: Translator } & string
