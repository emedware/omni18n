export * from '../types'
export * from '../client/index'
export * from '../tools/cgpt-js'

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
