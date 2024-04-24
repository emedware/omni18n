/// <reference path="./geni18n.d.ts" />
/**
 * i18n consumption/usage, both client and server side.
 */
import objectParser from 'js-object-parser'

// TODO: add `set` ability for translators?

class TranslationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'translationError'
	}
}

function objectArgument(arg: string): string | Record<string, string> {
	if(!arg.includes(':')) return arg
	return Object.fromEntries(arg.split(',').map((part) => part.split(':').map((part) => part.trim())) as [string, string][])
}

// Can be extended externally
// TODO validate arguments?
export const translationFunctions = {
	upper(str: string) { return str.toUpperCase() },
	lower(str: string) { return str.toLowerCase() },
	title(str: string) { return str.replace(/\b\w/g, (letter) => letter.toUpperCase()) },
	number(str:string, options?: string) {
		const num = parseFloat(str)
		if(isNaN(num)) return this.error(`${str} is not a number`)
		const numOptions = options ? objectArgument(options) : {}
		if(typeof numOptions === 'string') return this.error(`Invalid number options: ${numOptions}`)
		return num.toLocaleString(this.locale, numOptions)
	},
	ordinal(this: Locale, str: string) {
		if(!this.internals.ordinals) return this.missing(['internals.ordinals']);
		const num = parseInt(str);
		if(isNaN(num)) return this.error(`${str} is not a number`)
		return this.internals.ordinals[this.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: Locale, str: string, designation: string, plural?: string) {
		const num = parseInt(str);
		if(isNaN(num)) return this.error(`${str} is not a number`)
		const rule = this.cardinalRules.select(num);
		const rules = plural ? {one: designation, other: plural} : objectArgument(designation)

		if(typeof rules === 'string') {
			if(!this.internals.plurals) return this.missing(['internals.plurals']);
			return this.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules ? rules[rule] :
			this.error(`Rule "${rule}" not found in ${designation}`)
	},
	cases(this: Locale, str: string, cases: string) {
		const casesObj = objectArgument(cases)
		if(typeof casesObj === 'string') return this.error(`Invalid cases object: ${casesObj}`)
		return str in casesObj ? casesObj[str] :
			this.error(`Case "${str}" not found in ${cases}`)
	}
}

function translate(dictionary: Locale, keys: string[], args: any[]) {
	let current = dictionary.condensed, value: string | undefined
	for(const key of keys) {
		if(!current[key]) break
		else if(typeof current[key] === 'string') value = current[key] as string
		else {
			if(current[key]['']) value = current[key][''] as string
			current = current[key] as Geni18n.CondensedDictionary
		}
	}
	if(!value) return dictionary.missing(keys)
	const placeholders = (value.match(/{(.*?)}/g)?.map((placeholder) => placeholder.slice(1, -1)) || []).map(
		(placeholder) => {
			// Special {0} for "First argument" syntax
			if(/^\d+$/.test(placeholder)) return args[parseInt(placeholder)]
			else {
				const [func, ...params] = placeholder.split('|').map((part) => part.trim()).map(
					(part) => part.replace(/\$(\d+)/g, (_, num) => args[parseInt(num)])
				);
				return func in translationFunctions ?
					translationFunctions[func].call(dictionary, ...params) :
					translate(dictionary, func.split('.'), params)
			}
		}),
		parts = value.split(/{.*?}/);
	
	return parts.map((part, i) => `${part}${placeholders[i]||''}`).join('')
}

function translator(locale: Locale, keys: string[] = []) {
	function translation(...args: any[]) {
		return translate(locale, keys, args)
	}
	return new Proxy(translation, {
		get: (target, key, receiver) => {
			switch(key) {
				case 'toString':
				case Symbol.toPrimitive:
				case Symbol.toStringTag:
				case 'valueOf':
					return translation()
				case 'constructor':
					return String
			}
			//if(key in target) return Reflect.get(target, key, receiver);
			if(typeof key !== 'string')
				throw new TranslationError(`Invalid key type: ${typeof key}`)
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
 * @example
 * {
 * 	ordinal: {one: '$st', two: '$nd', few: '$rd', other: '$th'},
 *  numeral: {one: '$', other: '$s'}
 * }
 */

export interface Internals {
	ordinals?: Record<string, string>
	plurals?: Record<string, string>
}

function parseInternals(dictionary: Geni18n.CondensedDictionary | string) {
	if(!dictionary) return {}
	if(typeof dictionary === 'string') return objectParser.parse(dictionary)
	const result = dictionary[''] ? objectParser.parse(dictionary['']) : {}
	for(const key in dictionary)
		if(key !== '')
			result[key] = parseInternals(dictionary[key])
	return result
}

function recurExtend(dst: Geni18n.CondensedDictionary, src: Geni18n.CondensedDictionary) {
	for(const key in src) {
		if(!dst[key]) dst[key] = src[key]
		else if(typeof dst[key] === 'object' && typeof src[key] === 'object') recurExtend(dst[key] as Geni18n.CondensedDictionary, src[key] as Geni18n.CondensedDictionary)
		else if(typeof dst[key] === 'object') dst[key][''] = src[key];
		else if(typeof src[key] === 'object') dst[key] = { '': dst[key], ...<Geni18n.CondensedDictionary>src[key] }
	}
}

export default class Locale {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	readonly internals: Internals = {}
	readonly loadedZones: string[] = []
	condensed: Geni18n.CondensedDictionary = {}
	private toLoadZones: string[] = []
	private loadingTimer: any | undefined = undefined
	public renderedZone: string

	public loaded: Promise<void> = Promise.resolve()
	private resolveLoaded: ()=>void = ()=>{}

	/**
	 * This should be called several times per rendering. If a user control has a specific zone, this should be
	 * called while rendering this UC. It allows to:
	 * - debug the missing/buggy translations
	 * - make sure only the needed translations end up downloaded
	 * With Svelte, this should be called in each "context" change indeed
	 */
	public enter(zone: string) {
		this.renderedZone = zone
		if(this.toLoadZones.includes(zone) || this.loadedZones.includes(zone)) return;
		this.toLoadZones.push(zone)
		if(this.loadingTimer) return
		this.loaded = new Promise((resolve) => this.resolveLoaded = resolve)
		this.loadingTimer = setTimeout(async () => {
			const toLoad = this.toLoadZones
			this.toLoadZones = []
			this.loadingTimer = undefined
			this.download(toLoad)
		})
	}

	private async download(zones: string[]) {
		const toLoad = zones.filter((zone) => !this.loadedZones.includes(zone));
		if(toLoad.length) {
			this.loadedZones.push(...toLoad);
			const imported = await this.condenser(this.locale, toLoad);
			recurExtend(this.condensed, imported);
		}
		this.resolveLoaded()
		this.resolveLoaded = ()=>{}
	}

	setLocale(locale: Intl.UnicodeBCP47LocaleIdentifier) {
		if(this.locale === locale) return
		this.locale = locale
		const toLoad = this.loadedZones
		this.loadedZones.length = 0
		this.condensed = {}
		this.download(toLoad)
	}

	constructor(
		public locale: Intl.UnicodeBCP47LocaleIdentifier,
		// On the server side, this is `server.condensed`. From the client-side this is an http request of some sort
		public condenser: (locale: Intl.UnicodeBCP47LocaleIdentifier, zones: string[])=> Promise<Geni18n.CondensedDictionary>
	) {
		this.ordinalRules = new Intl.PluralRules(locale, { type: "ordinal" });
		this.cardinalRules = new Intl.PluralRules(locale, { type: "cardinal" });
		this.enter('')
		if(this.condensed.internals) this.internals = parseInternals(this.condensed.internals)
	}
	get translation() {
		return translator(this)
	}
	// Plîze override us
	missing(keys: string[]) {
		return `[${keys.join('.')}]`;
	}
	error(error: string) {
		return `[!${error}]`;
	}
}
