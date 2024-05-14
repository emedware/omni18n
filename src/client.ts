export {
	type CondensedDictionary,
	type Condense,
	type Locale,
	type OnModification,
	type TextKey,
	type Translation,
	type Zone,
	type WorkDictionary,
	type WorkDictionaryEntry,
	type WorkDictionaryText
} from './types'
export {
	I18nClient,
	type TContext,
	getContext,
	TranslationError,
	type ClientDictionary,
	type Translator,
	reports,
	bulkObject,
	bulkDictionary,
	formats,
	processors
} from './client/index'
export { localeFlags, flagCodeExceptions } from './flags'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
