export {
	type CondensedDictionary,
	type Condense,
	type InteractiveDB,
	type Locale,
	type OnModification,
	type RawDictionary,
	type TextKey,
	type Translation,
	type Zone,
	type WorkDictionary,
	type WorkDictionaryEntry,
	type WorkDictionaryText,
	type DB
} from './types'
export {
	I18nClient,
	type TContext,
	getContext,
	TranslationError,
	type ClientDictionary,
	type Translator,
	type ReportingClient,
	reports,
	bulkObject,
	bulkDictionary,
	formats,
	processors
} from './client/index'
export {
	I18nServer,
	InteractiveServer,
	type Modification,
	specs2url,
	url2specs
} from './server/index'
export { FileDB, MemDB, type MemDBDictionary, type MemDBDictionaryEntry } from './db/index'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
