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
	type WorkDictionaryText,
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
	processors,
	localeFlags,
	flagCodeExceptions
} from './client'
export { type RawDictionary, type InteractiveDB, type DB } from './types'
export {
	I18nServer,
	InteractiveServer,
	type Modification,
	specs2url,
	url2specs
} from './server/index'
export { FileDB, MemDB, type MemDBDictionary, type MemDBDictionaryEntry } from './db/index'
