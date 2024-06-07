import { parse } from '../tools/cgpt-js'
import { type CondensedDictionary, type TextKey, type Translation } from '../types'
import {
	ClientDictionary,
	TContext,
	Translatable,
	TranslationError,
	Translator,
	contextKey,
	fallback,
	text
} from './types'

const untranslatable = {
	// Must be un-then-able in order to be awaited
	then: undefined,
	// Vue reference mechanism
	__v_isRef: undefined,
	__v_raw: undefined
}

function entry(t: Translation, isFallback?: boolean): ClientDictionary {
	return { [text]: t, ...(isFallback ? { [fallback]: true } : {}) }
}

export function reportMissing(context: TContext, fallback?: Translation) {
	const { client, key } = context
	return client.missing(key, fallback)
}

export function reportError(context: TContext, error: string, spec: object) {
	const { client, key } = context
	return client.error(key, error, spec)
}

export const reports = {
	/**
	 * Report a missing translation
	 * @param key The key that is missing
	 * @param client The client that is missing the translation. The expected locale is in `client.locales[0]`
	 * @param fallback A fallback from another language if any
	 * @returns The string to display instead of the expected translation
	 */
	missing({ key, client }: TContext, fallback?: Translation): string {
		return fallback ?? `[${key}]`
	},
	/**
	 * Report a missing translation
	 * @param key The key that is missing
	 * @param client The client that is missing the translation. The expected locale is in `client.locales[0]`
	 * @param fallback A fallback from another language if any
	 * @returns The string to display instead of the expected translation
	 */
	error({ key, client }: TContext, error: string, spec: object): string {
		return `[!${error}!]`
	}
}

export function translate(context: TContext, args: any[]): string {
	const { client, key } = context
	let current = client.dictionary,
		value: [Translation, true | undefined] | undefined

	for (const k of key.split('.')) {
		if (!current[k]) break
		else {
			const next = current[k] as ClientDictionary
			if (text in next) value = [next[text]!, next[fallback]]
			current = next
		}
	}

	return value?.[1]
		? client.interpolate(key, reportMissing(context, value[0]), ...args)
		: value
			? client.interpolate(key, value[0], ...args)
			: reportMissing(context)
}

export function translator(context: TContext): Translator {
	Object.freeze(context)
	function escapeArgs(args: any[]) {
		// TODO? replace more that \ and :
		return args.map((a) => (typeof a === 'string' ? a.replace(/([\\:])/g, '\\$1') : a))
	}
	const translation = context.key
		? function (...args: any[]): string {
				return translate(context, escapeArgs(args))
			}
		: function (key?: TextKey, ...args: any[]): string {
				if (!key) throw new TranslationError('Root translator called without key')
				if (typeof key === 'string') return translate({ ...context, key }, escapeArgs(args))
				return translate({ ...context, key }, args)
			}
	const primitive = <Translator>new Proxy(translation, {
		get(target, key) {
			if (key in untranslatable) return untranslatable[key as keyof typeof untranslatable]
			switch (key) {
				//? case 'toJSON':	// Occurs on JSON.stringify
				case 'toString':
				case Symbol.toStringTag:
				case 'valueOf':
					return translation()
				case Symbol.toPrimitive:
					return primitive
				case 'constructor':
					return String
				case contextKey:
					return context
			}
			if (typeof key !== 'string') throw new TranslationError(`Invalid key type: ${typeof key}`)
			return translator({ ...context, key: context.key ? `${context.key}.${key}` : key })
		}
	})
	return primitive
}

export function parseInternals(dictionary: ClientDictionary | string) {
	if (!dictionary) return {}
	if (typeof dictionary === 'string') return parse(dictionary)
	const result = text in dictionary ? <any>parse(dictionary[text]!) : {}
	for (const key in dictionary) if (key !== '') result[key] = parseInternals(dictionary[key])
	return result
}

function condensed2dictionary(condensed: CondensedDictionary): ClientDictionary {
	const dictionary: ClientDictionary =
		'' in condensed ? entry(condensed['']!, !!condensed['.']) : {}
	for (const key in condensed)
		if (!['', '.'].includes(key)) {
			const value = condensed[key]
			if (typeof value === 'string') dictionary[key] = entry(value)
			else dictionary[key] = condensed2dictionary(value)
		}
	return dictionary
}

export function recurExtend(dst: ClientDictionary, src: CondensedDictionary) {
	for (const key in src)
		if (key === '') Object.assign(dst, entry(src[key]!, !!src['.']))
		else if (key !== '.') {
			if (!dst[key])
				dst[key] =
					typeof src[key] === 'string'
						? entry(<TextKey>src[key])
						: condensed2dictionary(<CondensedDictionary>src[key])
			else {
				if (typeof src[key] === 'string')
					dst[key] = {
						...dst[key],
						...entry(<TextKey>src[key])
					}
				else recurExtend(dst[key], <CondensedDictionary>src[key])
			}
		}
}

export function longKeyList(condensed: CondensedDictionary) {
	const keys: TextKey[] = []
	function recur(current: CondensedDictionary, prefix: string) {
		if (typeof current === 'string') keys.push(prefix)
		else {
			if (prefix && text in current) keys.push(prefix)
			for (const key in current)
				if (key) {
					const newPrefix = prefix ? `${prefix}.${key}` : key
					recur(current[key] as CondensedDictionary, newPrefix)
				}
		}
	}
	recur(condensed, '')
	return keys
}

export function mergeCondensed(dst: CondensedDictionary, src: CondensedDictionary) {
	for (const k in src) {
		if (!(k in dst)) dst = { ...dst, [k]: src[k] }
		else if (typeof src[k] === 'string') {
			if (typeof dst[k] === 'string') throw new TranslationError(`Conflicting keys: ${k}`)
			;(dst[k] as CondensedDictionary)[''] = src[k] as string
		} else {
			dst[k] = mergeCondensed(
				typeof dst[k] === 'string' ? { '': dst[k] as string } : (dst[k] as CondensedDictionary),
				src[k] as CondensedDictionary
			)
		}
	}
	return dst
}

export function bulkObject<T extends Translatable = Translatable>(
	t: Translator,
	source: T,
	...args: any[]
): T {
	const context = t[contextKey]
	function recursivelyTranslate<T extends Translatable>(obj: T): T {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [
				k,
				typeof v === 'string' ? translate({ ...context, key: v }, args) : recursivelyTranslate(v)
			])
		) as T
	}
	return recursivelyTranslate(source)
}
export function bulkDictionary<T extends Translatable = Translatable>(
	t: Translator,
	...args: any[]
): T | string {
	const context = t[contextKey],
		{ client, key } = context

	let current = client.dictionary
	for (const k of key.split('.')) {
		current = current[k] as ClientDictionary
		if (!current) break
	}
	if (!current) return reportMissing({ ...context, key })
	function dictionaryToTranslation(obj: ClientDictionary, key: TextKey): T | string {
		const rv: any = {}
		const subCtx = { ...context, key }
		const value = () =>
			context.client.interpolate(
				key,
				obj[fallback] ? reportMissing(subCtx, obj[text]) : obj[text]!,
				...args
			)
		if (Object.keys(obj).every((k) => typeof k === 'symbol')) return value()
		for (const [k, v] of Object.entries(obj))
			rv[k] = dictionaryToTranslation(v, key ? `${key}.${k}` : k)
		if (obj[text]) Object.defineProperty(rv, 'toString', { value })
		return <T>rv
	}
	return dictionaryToTranslation(current, key)
}

export function split2(s: string, sep: string) {
	const ndx = s.indexOf(sep)
	if (ndx === -1) return [s]
	return [s.slice(0, ndx), s.slice(ndx + sep.length)]
}
