export * from './types'
export * from './client/index'
export * from './flags'
export * from './cgpt-js'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
