import { parse } from 'hjson'
import {
	ClientDictionary,
	TContext,
	TranslationError,
	Translator,
	text,
	zone,
	fallback
} from './types'

function entry(t: string, z: string, isFallback?: boolean): ClientDictionary {
	return { [text]: t, [zone]: z, ...(isFallback ? { [fallback]: true } : {}) }
}

export function reportMissing(context: TContext, fallback?: string): string {
	if (!context.client.loading) return reports.missing(context, fallback)
	if (!context.client.onModification) context.client.checkOnLoad.add(context.key)
	return reports.loading(context)
}

export const reports = {
	loading({ client }: TContext): string {
		return '...' // `onModification` callback has been provided
	},
	/**
	 * Report a missing translation
	 * @param key The key that is missing
	 * @param client The client that is missing the translation. The expected locale is in `client.locales[0]`
	 * @param fallback A fallback from another language if any
	 * @returns The string to display instead of the expected translation
	 */
	missing({ key, client }: TContext, fallback?: string): string {
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
	const { client, key } = context,
		keys = key.split('.')
	let current = client.dictionary,
		value: [string, string, true | undefined] | undefined

	for (const k of keys) {
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
	const translation = context.key
		? function (...args: any[]): string {
				return translate(context, args)
			}
		: function (key?: string, ...args: any[]): string {
				if (!key) throw new TranslationError('Root translator called without key')
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
						? entry(<string>src[key], zone)
						: condensed2dictionary(<OmnI18n.CondensedDictionary>src[key], zone)
			else {
				if (typeof src[key] === 'string')
					dst[key] = {
						...dst[key],
						...entry(<string>src[key], zone)
					}
				else recurExtend(dst[key], <OmnI18n.CondensedDictionary>src[key], zone)
			}
		}
}

export function longKeyList(condensed: OmnI18n.CondensedDictionary) {
	const keys: string[] = []
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
