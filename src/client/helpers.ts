import { parse } from 'hjson'
import { ClientDictionary, TContext, TranslationError, Translator } from './types'

export const reports = {
	missing({ key }: TContext, zone?: OmnI18n.Zone): string {
		return `[${key}]`
	},
	error(context: TContext, error: string, spec: object): string {
		return `[!${error}]`
	}
}

export function translate(context: TContext, args: any[]): string {
	const { client, key } = context,
		keys = key.split('.')
	let current = client.dictionary,
		value: [string, string] | undefined

	for (const k of keys) {
		if (!current[k]) break
		else {
			const next = current[k] as ClientDictionary
			if ('' in next) value = [next['']!, next['.']!]
			current = next
		}
	}
	if (value && !context.zones.includes(value[1])) reports.missing(context, value[1])
	return value ? client.interpolate(context, value[0], args) : reports.missing(context)
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
	const result = '' in dictionary ? parse(dictionary['']!) : {}
	for (const key in dictionary) if (key !== '') result[key] = parseInternals(dictionary[key])
	return result
}

function condensed2dictionary(
	condensed: OmnI18n.CondensedDictionary,
	zone: OmnI18n.Zone
): ClientDictionary {
	const dictionary: ClientDictionary =
		'' in condensed ? <ClientDictionary>{ '': condensed[''], '.': zone } : {}
	for (const key in condensed)
		if (key) {
			const value = condensed[key]
			if (typeof value === 'string') dictionary[key] = <ClientDictionary>{ '': value, '.': zone }
			else dictionary[key] = condensed2dictionary(value, zone)
		}
	return dictionary
}

export function recurExtend(
	dst: ClientDictionary,
	src: OmnI18n.CondensedDictionary,
	zone: OmnI18n.Zone
) {
	for (const key in src) {
		if (!dst[key])
			dst[key] =
				typeof src[key] === 'string'
					? <ClientDictionary>{ '': src[key], '.': zone }
					: condensed2dictionary(<OmnI18n.CondensedDictionary>src[key], zone)
		else {
			if (typeof src[key] === 'string')
				dst[key] = <ClientDictionary>{
					...dst[key],
					'': src[key],
					'.': zone
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
			if (prefix && '' in current) keys.push(prefix)
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
