export * from './types'
export * from './client/index'
export * from './flags'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
