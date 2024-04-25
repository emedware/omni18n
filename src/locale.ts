/// <reference path="./geni18n.d.ts" />
/**
 * i18n consumption/usage, both client and server side.
 */
import { parse } from 'hjson'
import Defer from './defer'

// TODO rename the class Locale (and its instances) to `I18n` for example?

class TranslationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'translationError'
	}
}

export interface TContext {
	key: string
	zones: string[]
	locale: Locale
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

export const formats = {
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

export let processors = {
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
		const { locale } = this
		if (!locale.internals.ordinals) return locale.missing({ ...this, key: 'internals.ordinals' })
		const num = parseInt(str)
		if (isNaN(num)) return locale.error('NaN', { str, ...this })
		return locale.internals.ordinals[locale.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: TContext, str: string, designation: string, plural?: string) {
		const num = parseInt(str),
			{ locale } = this
		if (isNaN(num)) return locale.error('NaN', { str, ...this })
		const rule = locale.cardinalRules.select(num)
		const rules = plural ? { one: designation, other: plural } : designation

		if (typeof rules === 'string') {
			if (!locale.internals.plurals) return locale.missing({ ...this, key: 'internals.plurals' })
			if (!locale.internals.plurals[rule])
				return locale.error('Missing rule in plurals', { rule, ...this })
			return locale.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules
			? rules[rule]
			: locale.error('Rule not found', { rule, designation, ...this })
	},
	number(this: TContext, str: string, options?: any) {
		const num = parseFloat(str),
			{ locale } = this
		if (isNaN(num)) return locale.error('NaN', { str, ...this })
		if (typeof options === 'string') {
			if (!(options in formats.number))
				return locale.error('Invalid number options', { options, ...this })
			options = formats.number[options]
		}
		return num.toLocaleString(locale.locale, options)
	},
	date(this: TContext, str: string, options?: any) {
		const nbr = parseInt(str),
			date = new Date(nbr),
			{ locale } = this
		if (isNaN(nbr)) return locale.error('Invalid date', { str, ...this })
		if (typeof options === 'string') {
			if (!(options in formats.date))
				return locale.error('Invalid date options', { options, ...this })
			options = formats.date[options]
		}
		if (locale.timeZone) options = { timeZone: locale.timeZone, ...options }
		return date.toLocaleString(locale.locale, options)
	},
	relative(this: TContext, str: string, options?: any) {
		const content = /(-?\d+)\s*(\w+)/.exec(str),
			{ locale } = this
		if (!content) return locale.error('Invalid relative format', { str, ...this })
		const nbr = parseInt(content[1]),
			unit = content[2]
		const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
		units.push(...units.map((unit) => unit + 's'))

		if (isNaN(nbr)) return locale.error('Invalid number', { str, ...this })
		if (!units.includes(unit)) return locale.error('Invalid unit', { unit, ...this })
		if (typeof options === 'string') {
			if (!(options in formats.relative))
				return locale.error('Invalid date options', { options, ...this })
			options = formats.date[options]
		}
		return new Intl.RelativeTimeFormat(locale.locale, options).format(
			nbr,
			<Intl.RelativeTimeFormatUnit>unit
		)
	},
	region(this: TContext, str: string) {
		return new Intl.DisplayNames([this.locale.locale], { type: 'region' }).of(str)
	},
	language(this: TContext, str: string) {
		return new Intl.DisplayNames([this.locale.locale], { type: 'language' }).of(str)
	},
	script(this: TContext, str: string) {
		return new Intl.DisplayNames([this.locale.locale], { type: 'script' }).of(str)
	},
	currency(this: TContext, str: string) {
		return new Intl.DisplayNames([this.locale.locale], { type: 'currency' }).of(str)
	}
}

function translate(context: TContext, args: any[]) {
	const { locale, key } = context,
		keys = key.split('.')
	let current = locale.condensed,
		value: string | undefined

	for (const k of keys) {
		if (!current[k]) break
		else if (typeof current[k] === 'string') value = current[k] as string
		else {
			if (current[k]['']) value = current[k][''] as string
			current = current[k] as Geni18n.CondensedDictionary
		}
	}
	return value ? locale.interpolate(context, value, args) : locale.missing(context)
}

function translator(context: TContext) {
	function translation(...args: any[]) {
		return translate(context, args)
	}
	return new Proxy(translation, {
		get: (target, key) => {
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

function parseInternals(dictionary: Geni18n.CondensedDictionary | string) {
	if (!dictionary) return {}
	if (typeof dictionary === 'string') return parse(dictionary)
	const result = dictionary[''] ? parse(dictionary['']) : {}
	for (const key in dictionary) if (key !== '') result[key] = parseInternals(dictionary[key])
	return result
}

function recurExtend(dst: Geni18n.CondensedDictionary, src: Geni18n.CondensedDictionary) {
	for (const key in src) {
		if (!dst[key]) dst[key] = src[key]
		else if (typeof dst[key] === 'object' && typeof src[key] === 'object')
			recurExtend(dst[key] as Geni18n.CondensedDictionary, src[key] as Geni18n.CondensedDictionary)
		else if (typeof dst[key] === 'object') dst[key][''] = src[key]
		else if (typeof src[key] === 'object')
			dst[key] = { '': dst[key], ...(<Geni18n.CondensedDictionary>src[key]) }
	}
}

export default class Locale {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	internals: Internals = {}
	loadedZones: string[] = []
	condensed: Geni18n.CondensedDictionary = {}
	private toLoadZones: string[] = []
	private loading = new Defer()

	public loaded: Promise<void> = Promise.resolve()

	public timeZone: string | undefined // = Intl.DateTimeFormat().resolvedOptions().timeZone

	constructor(
		public locale: Geni18n.LocaleName,
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condenser: (
			locale: Geni18n.LocaleName,
			zones: string[]
		) => Promise<Geni18n.CondensedDictionary>
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
		const knownZones = [...this.loadedZones, ...this.toLoadZones],
			toAdd = zones.filter((zone) => !knownZones.includes(zone))
		if (toAdd.length) {
			this.toLoadZones.push(...toAdd)
			this.loaded = this.loading.defer(async () => {
				const toLoad = this.toLoadZones
				this.toLoadZones = []
				await this.download(toLoad)
			})
		}
		return translator({ locale: this, zones, key: '' })
	}

	private async download(zones: string[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.includes(zone))
		if (toLoad.length) {
			this.loadedZones.push(...toLoad)
			const imported = await this.condenser(this.locale, toLoad)
			recurExtend(this.condensed, imported)
			if (zones.includes('') && this.condensed.internals)
				this.internals = parseInternals(this.condensed.internals)
		}
	}

	async setLocale(locale: Geni18n.LocaleName) {
		if (this.locale === locale) return
		this.locale = locale
		const toLoad = this.loadedZones
		this.loadedZones = []
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
				if (!browser[key]) browser[key] = {}
				else if (typeof browser[key] === 'string') browser[key] = { '': browser[key] }
				browser = browser[key] as Geni18n.CondensedDictionary
			}
			if (typeof value === undefined) {
				if (typeof browser[lastKey] === 'object') delete browser[lastKey]['']
				else delete browser[lastKey]
			} else {
				if (typeof browser[lastKey] === 'object') browser[lastKey][''] = value
				else browser[lastKey] = <string>value
			}
		}
	}

	//#region Overridable methods

	interpolate(context: TContext, text: string, args: any[]) {
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
					: this.error('Missing arg', { arg: i, key })
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
							? this.error('Case needs a string case', { params, ...context })
							: params[0] in proc
								? proc[params[0]]
								: this.error('Case not found', { case: params[0], cases: proc, ...context })
					if (proc.includes('.')) return translate({ ...context, key: proc }, params)
					if (!(proc in processors)) return this.error('Unknown processor', { proc, ...context })
					try {
						return processors[proc].call(context, ...params)
					} catch (error) {
						return this.error('Error in processor', { proc, error, ...context })
					}
				}
			}),
			parts = text.split(/{.*?}/)

		return parts.map((part, i) => `${part}${placeholders[i] || ''}`).join('')
	}

	// Plîze override us
	missing({ key, zones }: TContext) {
		// report this.locale, this.loadedZones
		return `[${key}]`
	}
	error(error: string, spec: TContext & Record<string, any>) {
		// report spec
		return `[!${error}]`
	}

	//#endregion
}
