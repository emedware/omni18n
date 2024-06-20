export * from './types'
export * from './client/index'
export * from './tools/gpt-js'
export * from './tools/flags'
import { default as Defer } from './tools/defer'
export { Defer }

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
