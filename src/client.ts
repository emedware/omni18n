/// <reference path="./geni18n.d.ts" />
/**
 * i18n consumption/usage, both client and server side.
 */
import './polyfill'
import { parse } from 'hjson'
import Defer from './defer'

type CDic = GenI18n.CondensedDictionary
type CDicE = CDic & string

class TranslationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'translationError'
	}
}

export const globals: { currency?: string } = {}

export interface TContext {
	key: string
	zones: string[]
	client: I18nClient
}

export const reports = {
	missing({ key }: TContext) {
		return `[${key}]`
	},
	error(error: string, spec: object, context: TContext) {
		return `[!${error}]`
	}
}

function objectArgument(arg: any): string | Record<string, string> {
	if (typeof arg === 'object') return arg
	// Here we throw as it means the code gave a wrong argument
	if (typeof arg !== 'string') throw new TranslationError(`Invalid argument type: ${typeof arg}`)
	if (!/[^:]:/.test(arg)) return arg.replace(/::/g, ':')
	return Object.fromEntries(
		arg
			.replace(/::/g, '\u0000')
			.split(',')
			.map((part) => part.split(':', 2).map((part) => part.replace(/\u0000/g, ':').trim()))
	)
}

export const formats: Record<'date' | 'number' | 'relative', Record<string, object>> = {
	date: {
		date: {
			dateStyle: 'short'
		},
		time: {
			timeStyle: 'short'
		}
	},
	number: {
		decimal: { style: 'decimal' },
		percent: { style: 'percent' },
		scientific: { notation: 'scientific' },
		engineering: { notation: 'engineering' },
		compact: { notation: 'compact' }
	},
	relative: {
		short: {
			numeric: 'always',
			style: 'short'
		},
		long: {
			numeric: 'auto',
			style: 'long'
		}
	}
}

export const processors: Record<string, (...args: any[]) => string> = {
	upper(str: string) {
		return str.toUpperCase()
	},
	lower(str: string) {
		return str.toLowerCase()
	},
	title(str: string) {
		return str.replace(/\b\w/g, (letter) => letter.toUpperCase())
	},
	ordinal(this: TContext, str: string) {
		const { client } = this
		if (!client.internals.ordinals) return reports.missing({ ...this, key: 'internals.ordinals' })
		const num = parseInt(str)
		if (isNaN(num)) return reports.error('NaN', { str }, this)
		return client.internals.ordinals[client.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: TContext, str: string, designation: string, plural?: string) {
		const num = parseInt(str),
			{ client } = this
		if (isNaN(num)) return reports.error('NaN', { str }, this)
		const rule = client.cardinalRules.select(num)
		const rules: string | Record<string, string> = plural
			? { one: designation, other: plural }
			: designation

		if (typeof rules === 'string') {
			if (!client.internals.plurals) return reports.missing({ ...this, key: 'internals.plurals' })
			if (!client.internals.plurals[rule])
				return reports.error('Missing rule in plurals', { rule }, this)
			return client.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules
			? rules[rule]
			: reports.error('Rule not found', { rule, designation }, this)
	},
	number(this: TContext, str: string, options?: any) {
		const num = parseFloat(str),
			{ client } = this
		if (isNaN(num)) return reports.error('NaN', { str }, this)
		if (typeof options === 'string') {
			if (!(options in formats.number))
				return reports.error('Invalid number options', { options }, this)
			options = formats.number[options]
		}
		options = {
			currency: globals.currency,
			...options
		}
		return num.toLocaleString(client.locale, options)
	},
	date(this: TContext, str: string, options?: any) {
		const nbr = parseInt(str),
			date = new Date(nbr),
			{ client } = this
		if (isNaN(nbr)) return reports.error('Invalid date', { str }, this)
		if (typeof options === 'string') {
			if (!(options in formats.date))
				return reports.error('Invalid date options', { options }, this)
			options = formats.date[options]
		}
		options = {
			timeZone: client.timeZone,
			...options
		}
		return date.toLocaleString(client.locale, options)
	},
	relative(this: TContext, str: string, options?: any) {
		const content = /(-?\d+)\s*(\w+)/.exec(str),
			{ client } = this
		if (!content) return reports.error('Invalid relative format', { str }, this)
		const nbr = parseInt(content[1]),
			unit = content[2]
		const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
		units.push(...units.map((unit) => unit + 's'))

		if (isNaN(nbr)) return reports.error('Invalid number', { str }, this)
		if (!units.includes(unit)) return reports.error('Invalid unit', { unit }, this)
		if (typeof options === 'string') {
			if (!(options in formats.relative))
				return reports.error('Invalid date options', { options }, this)
			options = formats.date[options]
		}
		return new Intl.RelativeTimeFormat(client.locale, options).format(
			nbr,
			<Intl.RelativeTimeFormatUnit>unit
		)
	},
	region(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'region' }).of(str) ||
			reports.error('Invalid region', { str }, this)
		)
	},
	language(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'language' }).of(str) ||
			reports.error('Invalid language', { str }, this)
		)
	},
	script(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'script' }).of(str) ||
			reports.error('Invalid script', { str }, this)
		)
	},
	currency(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'currency' }).of(str) ||
			reports.error('Invalid currency', { str }, this)
		)
	}
}

function translate(context: TContext, args: any[]): string {
	const { client, key } = context,
		keys = key.split('.')
	let current = client.condensed,
		value: string | undefined

	for (const k of keys) {
		if (!current[k]) break
		else if (typeof current[k] === 'string') value = current[k] as string
		else {
			const next = current[k] as CDic
			if (next['']) value = next[''] as string
			current = next
		}
	}
	return value ? client.interpolate(context, value, args) : reports.missing(context)
}
export type Translator = { [k: string]: Translator } & ((...args: any[]) => string) & string

function translator(context: TContext): Translator {
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

/**
 * Used for translation functions called in the translation.
 * {ordinal|$0} will be, as the first argument is a number, replaced with the ordinal of that number.
 * {plural|$0|one:ox,other:oxen} will be, as the first argument is a number and the second is a string key, replaced with the plural of the string based on the number.
 * {plural|$0|ox|oxen} is a shortcut for the above, using {one:..., other: ...} as most languages have only two numeric forms.
 * {plural|$0|ball} will use the plural specification given here
 *
 * These contain sub-keys or hjson string values
 *
 * @example
 * {
 * 	ordinals: {one: '$st', two: '$nd', few: '$rd', other: '$th'},
 *  numerals: {one: '$', other: '$s'}
 * }
 */

export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

function parseInternals(dictionary: CDic | string) {
	if (!dictionary) return {}
	if (typeof dictionary === 'string') return parse(dictionary)
	const result = dictionary[''] ? parse(dictionary['']) : {}
	for (const key in dictionary) if (key !== '') result[key] = parseInternals(dictionary[key])
	return result
}

function recurExtend(dst: CDic, src: CDic) {
	for (const key in src) {
		if (!dst[key]) dst[key] = src[key]
		else if (typeof dst[key] === 'object' && typeof src[key] === 'object')
			recurExtend(dst[key] as CDic, src[key] as CDic)
		else if (typeof dst[key] === 'object') (<CDic>dst[key])[''] = <string>src[key]
		else if (typeof src[key] === 'object')
			dst[key] = <CDicE>{ '': <string>dst[key], ...(<CDic>src[key]) }
	}
}

export default class I18nClient {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	internals: Internals = {}
	condensed: CDic = {}
	protected loadedZones = new Set<GenI18n.Zone>()
	private toLoadZones = new Set<GenI18n.Zone>()
	private loading = new Defer()

	public loaded: Promise<void> = Promise.resolve()

	public timeZone?: string // = Intl.DateTimeFormat().resolvedOptions()

	constructor(
		public locale: GenI18n.LocaleName,
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condenser: (locale: GenI18n.LocaleName, zones: string[]) => Promise<CDic>
	) {
		this.ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' })
		this.cardinalRules = new Intl.PluralRules(locale, { type: 'cardinal' })
		this.enter('')
	}

	/**
	 * This should be called for each user-control, page, ...
	 * If zoning per user role, the call can specify no zone and the zone can be specified on main page-load or user change
	 * If zoning per user-control/page, the call should specify the zone (path separated by '.')
	 * @param zones Zones entered
	 * @returns The translator
	 */
	public enter(...zones: string[]) {
		const knownZones = this.loadedZones.union(this.toLoadZones),
			toAdd = zones.filter((zone) => !knownZones.has(zone))
		if (toAdd.length) {
			for (const t of toAdd) this.toLoadZones.add(t)
			this.loaded = this.loading.defer(async () => {
				const toLoad = this.toLoadZones
				this.toLoadZones = new Set()
				await this.download(Array.from(toLoad))
			})
		}
		return translator({ client: this, zones, key: '' })
	}

	protected received(zones: string[], condensed: CDic) {
		for (const zone of zones) this.loadedZones.add(zone)
		recurExtend(this.condensed, condensed)
		if (zones.includes('') && condensed.internals)
			this.internals = parseInternals(condensed.internals)
	}

	private async download(zones: string[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.has(zone))
		if (toLoad.length) this.received(toLoad, await this.condenser(this.locale, toLoad))
	}

	async setLocale(locale: GenI18n.LocaleName) {
		if (this.locale === locale) return
		this.locale = locale
		const toLoad = Array.from(this.loadedZones)
		this.loadedZones = new Set()
		this.condensed = {}
		this.internals = {}
		await this.download(toLoad)
	}

	modified(entries: Record<string, string | undefined>) {
		for (const [key, value] of Object.entries(entries)) {
			const keys = key.split('.'),
				lastKey = keys.pop() as string
			let browser = this.condensed
			for (const key of keys) {
				if (!browser[key]) browser[key] = <CDicE>{}
				else if (typeof browser[key] === 'string')
					browser[key] = <CDicE>{ '': <string>browser[key] }
				browser = browser[key] as CDic
			}
			if (value === undefined) {
				if (typeof browser[lastKey] === 'object') delete (<CDic>browser[lastKey])['']
				else delete browser[lastKey]
			} else {
				if (typeof browser[lastKey] === 'object') (<CDic>browser[lastKey])[''] = value
				else browser[lastKey] = <CDicE>value
			}
		}
	}

	// TODO escape {{ and }}
	interpolate(context: TContext, text: string, args: any[]): string {
		const { key, zones } = context
		function arg(i: string | number, dft?: string) {
			if (typeof i === 'string' && /^\d+$/.test(i)) i = parseInt(i)
			if (i === 0) return key
			const lastArg = args[args.length - 1],
				val =
					i === '$'
						? '$'
						: i === ''
							? lastArg
							: typeof i === 'number'
								? args[i - 1]
								: typeof lastArg === 'object' && i in lastArg
									? lastArg[i]
									: undefined
			if (val instanceof Date) return '' + val.getTime()
			if (typeof val === 'object')
				return Object.entries(val)
					.map(([key, value]) => `${key}: ${value}`)
					.join(', ')
			if (typeof val === 'number') return '' + val
			return val !== undefined
				? val
				: dft !== undefined
					? dft
					: reports.error('Missing arg', { arg: i, key }, context)
		}
		const placeholders = (
				text.match(/{(.*?)}/g)?.map((placeholder) => placeholder.slice(1, -1)) || []
			).map((placeholder) => {
				// Special {=0}, {=0|default} for "First argument" syntax
				const simpleArg = /^=(\w*)(?:\s*\|\s*(.*)\s*)?$/.exec(placeholder)
				if (simpleArg) return arg(simpleArg[1], simpleArg[2])
				else {
					const [proc, ...params] = placeholder
						.split('|')
						.map((part) => part.trim())
						.map((part) => part.replace(/\$(\w*)(?:\[(.*?)\])?/g, (_, num, dft) => arg(num, dft)))
						.map((part) => objectArgument(part))
					if (typeof proc === 'object')
						return params.length !== 1 || typeof params[0] !== 'string'
							? reports.error('Case needs a string case', { params }, context)
							: params[0] in proc
								? proc[params[0]]
								: reports.error('Case not found', { case: params[0], cases: proc }, context)
					if (proc.includes('.')) return translate({ ...context, key: proc }, params)
					if (!(proc in processors)) return reports.error('Unknown processor', { proc }, context)
					try {
						return processors[proc].call(context, ...params)
					} catch (error) {
						return reports.error('Error in processor', { proc, error }, context)
					}
				}
			}),
			parts = text.split(/{.*?}/)

		return parts.map((part, i) => `${part}${placeholders[i] || ''}`).join('')
	}
}
