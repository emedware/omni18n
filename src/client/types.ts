import {
	type CondensedDictionary,
	type Condense,
	type InteractiveDB,
	type Locale,
	type OnModification,
	type RawDictionary,
	type TextKey,
	type Translation,
	type Zone,
	WorkDictionary
} from '../types'

export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

export const zone = Symbol('Zone'),
	text = Symbol('Text'),
	fallback = Symbol('Fallback'),
	contextKey = Symbol('context')

export type ClientDictionary = {
	[key: TextKey]: ClientDictionary
	[zone]?: Zone
	[text]?: Translation
	[fallback]?: true
}

export interface OmnI18nClient {
	dictionary: ClientDictionary
	internals: Internals
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	locales: Locale[]
	timeZone?: string
	currency?: string
	interpolate(context: TContext, text: Translation, args: any[]): string
	onModification?: OnModification
}

export interface ReportingClient extends OmnI18nClient {
	missing(key: string, fallback: Translation | undefined, zones: Zone[]): string
	error(key: string, error: string, spec: object, zones: Zone[]): string
}

export interface TContext<Client extends OmnI18nClient = OmnI18nClient> {
	key: TextKey
	zones: Zone[]
	client: Client
}

export class TranslationError extends Error {
	name = 'TranslationError'
}

export type Translator = ((...args: any[]) => string) & {
	[k: TextKey]: Translator
	[contextKey]: TContext
}

export type Translatable = { [key: TextKey]: Translatable | string }
