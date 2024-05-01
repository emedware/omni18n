import { parse } from 'hjson'
import {
	ClientDictionary,
	TContext,
	TranslationError,
	Translator,
	text,
	zone,
	fallback,
	contextKey,
	Translatable,
	ReportingClient
} from './types'
import { interpolate } from './interpolation'

function entry(t: OmnI18n.Translation, z: OmnI18n.Zone, isFallback?: boolean): ClientDictionary {
	return { [text]: t, [zone]: z, ...(isFallback ? { [fallback]: true } : {}) }
}

export function reportMissing(context: TContext, fallback?: OmnI18n.Translation) {
	const { client, key } = context
	return 'missing' in client
		? (<ReportingClient>client).missing(key, fallback, context.zones)
		: reports.missing(context, fallback)
}

export function reportError(context: TContext, error: string, spec: object) {
	const { client, key } = context
	return 'error' in client
		? (<ReportingClient>client).error(key, error, spec, context.zones)
		: reports.error(context, error, spec)
}

export const reports = {
	/**
	 * Report a missing translation
	 * @param key The key that is missing
	 * @param client The client that is missing the translation. The expected locale is in `client.locales[0]`
	 * @param fallback A fallback from another language if any
	 * @returns The string to display instead of the expected translation
	 */
	missing({ key, client }: TContext, fallback?: OmnI18n.Translation): string {
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
		return `[!${error}]`
	}
}

export function translate(context: TContext, args: any[]): string {
	const { client, key } = context
	let current = client.dictionary,
		value: [OmnI18n.Translation, OmnI18n.Zone, true | undefined] | undefined

	for (const k of key.split('.')) {
		if (!current[k]) break
		else {
			const next = current[k] as ClientDictionary
			if (text in next) value = [next[text]!, next[zone]!, next[fallback]]
			current = next
		}
	}

	return value?.[2]
		? client.interpolate(context, reportMissing(context, value[0]), args)
		: value
			? client.interpolate(context, value[0], args)
			: reportMissing(context)
}

export function translator(context: TContext): Translator {
	Object.freeze(context)
	const translation = context.key
		? function (...args: any[]): string {
				return translate(context, args)
			}
		: function (key?: OmnI18n.TextKey, ...args: any[]): string {
				if (!key) throw new TranslationError('Root translator called without key')
				if (typeof key === 'string') return translate({ ...context, key }, args)
				return translate({ ...context, key }, args)
			}
	return <Translator>new Proxy(translation, {
		get(target, key) {
			switch (key) {
				case 'toString':
				case Symbol.toStringTag:
				case 'valueOf':
					return translation()
				case Symbol.toPrimitive:
					return target
				case 'constructor':
					return String
				case 'then': // Must be un-then-able in order to be awaited
					return new Proxy(
						{},
						{
							get(target, p, receiver) {
								const msg = 'Translators must be unthenable. `then` cannot be used as a text key.'
								if (p === 'toString') return msg
								throw new TranslationError(msg)
							}
						}
					)
				case contextKey:
					return context
			}
			if (typeof key !== 'string') throw new TranslationError(`Invalid key type: ${typeof key}`)
			return translator({ ...context, key: context.key ? `${context.key}.${key}` : key })
		}
	})
}

export function parseInternals(dictionary: ClientDictionary | string) {
	if (!dictionary) return {}
	if (typeof dictionary === 'string') return parse(dictionary)
	const result = text in dictionary ? parse(dictionary[text]!) : {}
	for (const key in dictionary) if (key !== '') result[key] = parseInternals(dictionary[key])
	return result
}

function condensed2dictionary(
	condensed: OmnI18n.CondensedDictionary,
	zone: OmnI18n.Zone
): ClientDictionary {
	const dictionary: ClientDictionary =
		'' in condensed ? entry(condensed['']!, zone, !!condensed['.']) : {}
	for (const key in condensed)
		if (!['', '.'].includes(key)) {
			const value = condensed[key]
			if (typeof value === 'string') dictionary[key] = entry(value, zone)
			else dictionary[key] = condensed2dictionary(value, zone)
		}
	return dictionary
}

export function recurExtend(
	dst: ClientDictionary,
	src: OmnI18n.CondensedDictionary,
	zone: OmnI18n.Zone
) {
	for (const key in src)
		if (key === '') Object.assign(dst, entry(src[key]!, zone, !!src['.']))
		else if (key !== '.') {
			if (!dst[key])
				dst[key] =
					typeof src[key] === 'string'
						? entry(<OmnI18n.TextKey>src[key], zone)
						: condensed2dictionary(<OmnI18n.CondensedDictionary>src[key], zone)
			else {
				if (typeof src[key] === 'string')
					dst[key] = {
						...dst[key],
						...entry(<OmnI18n.TextKey>src[key], zone)
					}
				else recurExtend(dst[key], <OmnI18n.CondensedDictionary>src[key], zone)
			}
		}
}

export function longKeyList(condensed: OmnI18n.CondensedDictionary) {
	const keys: OmnI18n.TextKey[] = []
	function recur(current: OmnI18n.CondensedDictionary, prefix: string) {
		if (typeof current === 'string') keys.push(prefix)
		else {
			if (prefix && text in current) keys.push(prefix)
			for (const key in current)
				if (key) {
					const newPrefix = prefix ? `${prefix}.${key}` : key
					recur(current[key] as OmnI18n.CondensedDictionary, newPrefix)
				}
		}
	}
	recur(condensed, '')
	return keys
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
	function dictionaryToTranslation(obj: ClientDictionary, key: OmnI18n.TextKey): T | string {
		const rv: any = {}
		const subCtx = { ...context, key }
		const value = () =>
			interpolate(subCtx, obj[fallback] ? reportMissing(subCtx, obj[text]) : obj[text]!, args)
		if (Object.keys(obj).every((k) => typeof k === 'symbol')) return value()
		for (const [k, v] of Object.entries(obj))
			rv[k] = dictionaryToTranslation(v, key ? `${key}.${k}` : k)
		if (obj[text]) Object.defineProperty(rv, 'toString', { value })
		return <T>rv
	}
	return dictionaryToTranslation(current, key)
}
