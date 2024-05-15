import {
	type Locale,
	type OnModification,
	type TextKey,
	type Translation,
	type Zone
} from '../types'

export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

export const text = Symbol('Text'),
	fallback = Symbol('Fallback'),
	contextKey = Symbol('context')

export type ClientDictionary = {
	[key: TextKey]: ClientDictionary
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
	interpolate(key: TextKey, text: Translation, ...args: any[]): string
	onModification?: OnModification
	missing(key: string, fallback?: Translation): string
	error(key: string, error: string, spec: object): string
}

export interface TContext<Client extends OmnI18nClient = OmnI18nClient> {
	key: TextKey
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
