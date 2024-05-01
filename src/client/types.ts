export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

export const zone = Symbol('Zone'),
	text = Symbol('Text'),
	fallback = Symbol('Fallback'),
	contextKey = Symbol('context')

export type ClientDictionary = {
	[key: OmnI18n.TextKey]: ClientDictionary
	[zone]?: OmnI18n.Zone
	[text]?: OmnI18n.Translation
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
	interpolate(context: TContext, text: OmnI18n.Translation, args: any[]): string
	onModification?: OmnI18n.OnModification
}

export interface ReportingClient extends OmnI18nClient {
	missing(key: string, fallback: OmnI18n.Translation | undefined, zones: OmnI18n.Zone[]): string
	error(key: string, error: string, spec: object, zones: OmnI18n.Zone[]): string
}

export interface TContext<Client extends OmnI18nClient = OmnI18nClient> {
	key: OmnI18n.TextKey
	zones: OmnI18n.Zone[]
	client: Client
}

export class TranslationError extends Error {
	name = 'TranslationError'
}

export type Translator = ((...args: any[]) => string) & {
	[k: OmnI18n.TextKey]: Translator
	[contextKey]: TContext
}

export type Translatable = { [key: OmnI18n.TextKey]: Translatable | string }
