export { default as I18nClient, Internals, TContext, formats, processors, reports } from './client'
export { default as I18nServer, InteractiveServer, DB, InteractiveDB } from './server'

import I18nClient from './client'
export default I18nClient

declare global {
	interface Set<T> {
		union(...sets: Set<T>[]): this
	}
}
