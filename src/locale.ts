/// <reference path="./geni18n.d.ts" />
/**
 * i18n consumption/usage, both client and server side.
 */
import { parse } from 'hjson'
import Defer from './defer'

// TODO: add `set` ability for translators?

class TranslationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'translationError'
	}
}

function objectArgument(arg: any): string | Record<string, string> {
	if (typeof arg === 'object') return arg
	// Here we throw as it means the code gave a wrong argument
	if (typeof arg !== 'string') throw new TranslationError(`Invalid argument type: ${typeof arg}`)
	if (!arg.includes(':')) return arg
	return Object.fromEntries(
		arg.split(',').map((part) => part.split(':').map((part) => part.trim())) as [string, string][]
	)
}

// Can be extended externally
export const processors = {
	upper(str: string) {
		return str.toUpperCase()
	},
	lower(str: string) {
		return str.toLowerCase()
	},
	title(str: string) {
		return str.replace(/\b\w/g, (letter) => letter.toUpperCase())
	},
	number(str: string, options?: any) {
		const num = parseFloat(str)
		if (isNaN(num)) return this.error('NaN', str)
		const numOptions = options ? objectArgument(options) : {}
		if (typeof numOptions === 'string') return this.error('Invalid number options', numOptions)
		return num.toLocaleString(this.locale, numOptions)
	},
	ordinal(this: Locale, str: string) {
		if (!this.internals.ordinals) return this.missing(['internals.ordinals'])
		const num = parseInt(str)
		if (isNaN(num)) return this.error('NaN', str)
		return this.internals.ordinals[this.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: Locale, str: string, designation: string, plural?: string) {
		const num = parseInt(str)
		if (isNaN(num)) return this.error('NaN', str)
		const rule = this.cardinalRules.select(num)
		const rules = plural ? { one: designation, other: plural } : objectArgument(designation)

		if (typeof rules === 'string') {
			if (!this.internals.plurals) return this.missing(['internals.plurals'])
			if (!this.internals.plurals[rule]) return this.error('Missing rule in plurals', rule)
			return this.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules ? rules[rule] : this.error('Rule not found', { rule, designation })
	},
	cases(this: Locale, str: string, cases: any) {
		const casesObj = objectArgument(cases)
		if (typeof casesObj === 'string') return this.error('Invalid cases', casesObj)
		return str in casesObj ? casesObj[str] : this.error('Case not found', { str, cases })
	}
}

function translate(locale: Locale, keys: string[], args: any[]) {
	let current = locale.condensed,
		value: string | undefined
	for (const key of keys) {
		if (!current[key]) break
		else if (typeof current[key] === 'string') value = current[key] as string
		else {
			if (current[key]['']) value = current[key][''] as string
			current = current[key] as Geni18n.CondensedDictionary
		}
	}
	if (!value) return locale.missing(keys)
	function arg(i: string | number, dft?: string) {
		if (typeof i === 'string' && /^\d+$/.test(i)) i = parseInt(i)
		return args[i] !== undefined
			? args[i]
			: dft !== undefined
				? dft
				: locale.error('Missing arg', i)
	}
	const placeholders = (
			value.match(/{(.*?)}/g)?.map((placeholder) => placeholder.slice(1, -1)) || []
		).map((placeholder) => {
			// Special {0}, {0|default} for "First argument" syntax
			const simpleArg = /^(\d+)(?:\s*\|\s*(.*)\s*)?$/.exec(placeholder)
			if (simpleArg) return arg(simpleArg[1], simpleArg[2])
			else {
				const [proc, ...params] = placeholder
					.split('|')
					.map((part) => part.trim())
					.map((part) => part.replace(/\$(\d+)(?:\[(.*?)\])?/g, (_, num, dft) => arg(num, dft)))
				if (proc in processors)
					try {
						return processors[proc].call(locale, ...params)
					} catch (error) {
						return locale.error('Error in processor', { proc, error })
					}
				return translate(locale, proc.split('.'), params)
			}
		}),
		parts = value.split(/{.*?}/)

	return locale.postProcessor(parts.map((part, i) => `${part}${placeholders[i] || ''}`).join(''))
}

function translator(locale: Locale, keys: string[] = []) {
	function translation(...args: any[]) {
		return translate(locale, keys, args)
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
			return translator(locale, keys.concat(key.split('.')))
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
	readonly loadedZones: string[] = []
	condensed: Geni18n.CondensedDictionary = {}
	private toLoadZones: string[] = []
	private loading = new Defer()
	public renderedZone: string
	readonly translation = translator(this)

	public loaded: Promise<void> = Promise.resolve()

	constructor(
		public locale: Geni18n.LocaleName,
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condenser: (
			locale: Geni18n.LocaleName,
			zones: string[]
		) => Promise<Geni18n.CondensedDictionary>,
		public postProcessor: (text: string) => string = (text) => text
	) {
		this.ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' })
		this.cardinalRules = new Intl.PluralRules(locale, { type: 'cardinal' })
		this.enter('')
	}

	/**
	 * This should be called several times per rendering. If a user control has a specific zone, this should be
	 * called while rendering this UC. It allows to:
	 * - debug the missing/buggy translations
	 * - make sure only the needed translations end up downloaded
	 * With Svelte, this should be called in each "context" change indeed
	 */
	public enter(zone: string) {
		this.renderedZone = zone
		if (this.toLoadZones.includes(zone) || this.loadedZones.includes(zone)) return
		this.toLoadZones.push(zone)
		this.loaded = this.loading.defer(async () => {
			const toLoad = this.toLoadZones
			this.toLoadZones = []
			await this.download(toLoad)
		})
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
		this.loadedZones.length = 0
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

	// Plîze override us
	missing(keys: string[]) {
		return `[${keys.join('.')}]`
	}
	error(error: string, spec?: any) {
		return `[!${error}]`
	}
}
