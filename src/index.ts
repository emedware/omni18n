export * from './client/index'
export * from './server/index'
export { default as JsonDB, JsonDictionary, JsonDictionaryEntry } from './json-db'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
