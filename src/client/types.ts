export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

export const zone = Symbol('Zone'),
	text = Symbol('Text'),
	fallback = Symbol('Fallback'),
	contextKey = Symbol('context')

export type ClientDictionary = {
	[key: string]: ClientDictionary
	[zone]?: string
	[text]?: OmnI18n.Zone
	[fallback]?: true
}

export interface OmnI18nClient {
	dictionary: ClientDictionary
	internals: Internals
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	locales: OmnI18n.Locale[]
	timeZone?: string
	currency?: string
	interpolate(context: TContext, text: string, args: any[]): string
	onModification?: OmnI18n.OnModification
}

export interface TContext<Client extends OmnI18nClient = OmnI18nClient> {
	key: string
	zones: string[]
	client: Client
}

export class TranslationError extends Error {
	name = 'TranslationError'
}

export type Translator = ((...args: any[]) => string) & {
	[k: string]: Translator
	[contextKey]: TContext
}

export type Translatable = { [key: string]: Translatable | string }
