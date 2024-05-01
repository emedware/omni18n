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
export { I18nServer, InteractiveServer, type Modification } from './server/index'
export { FileDB, MemDB, type MemDBDictionary, type MemDBDictionaryEntry } from './db/index'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
