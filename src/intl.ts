import { CondensedDictionary } from "./common";
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

// Override these to have custom error messages and logging
export const reports = {
	missing(dictionary: Dictionary, keys: string[]) {
		return `[${keys.join('.')}]`;
	},
	error(dictionary: Dictionary, error: string) {
		return `[!${error}]`;
	}
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
	ordinal(this: Dictionary, str: string) {
		if(!this.internals.ordinals) return this.missing(['internals.ordinals']);
		const num = parseInt(str);
		if(isNaN(num)) return this.error(`${str} is not a number`)
		return this.internals.ordinals[this.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: Dictionary, str: string, designation: string, plural?: string) {
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
	cases(this: Dictionary, str: string, cases: string) {
		const casesObj = objectArgument(cases)
		if(typeof casesObj === 'string') return this.error(`Invalid cases object: ${casesObj}`)
		return str in casesObj ? casesObj[str] :
			this.error(`Case "${str}" not found in ${cases}`)
	}
}

function translate(dictionary: Dictionary, keys: string[], args: any[]) {
	let current = dictionary.condensed, value: string | undefined
	for(const key of keys) {
		if(!current[key]) break
		else if(typeof current[key] === 'string') value = current[key] as string
		else {
			if(current[key]['']) value = current[key][''] as string
			current = current[key] as CondensedDictionary
		}
	}
	if(!value) return dictionary.missing(keys)
	const placeholders = (value.match(/{(.*?)}/g)?.map((placeholder) => placeholder.slice(1, -1)) || []).map(
		(placeholder) => {
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

function translator(Dictionary: Dictionary, keys: string[] = []) {
	function translation(...args: any[]) {
		return translate(Dictionary, keys, args)
	}
	translation.toString = translation
	const result = new Proxy(translation, {
		get: (_, key) => {
			if(typeof key !== 'string') throw new TranslationError('Invalid key')
			keys.push(...key.split('.'))
			return result
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

function parseInternals(dictionary: CondensedDictionary | string) {
	if(!dictionary) return {}
	if(typeof dictionary === 'string') return objectParser.parse(dictionary)
	const result = dictionary[''] ? objectParser.parse(dictionary['']) : {}
	for(const key in dictionary)
		if(key !== '')
			result[key] = parseInternals(dictionary[key])
	return result
}

class Dictionary {
	readonly ordinalRules: Intl.PluralRules
	readonly cardinalRules: Intl.PluralRules
	readonly internals: Internals = {}
	constructor(public locale: Intl.UnicodeBCP47LocaleIdentifier, public condensed: CondensedDictionary) {
		const translation = (key: string, ...args: any[]) => translate(this, key.split('.'), args)

		this.ordinalRules = new Intl.PluralRules(locale, { type: "ordinal" });
		this.cardinalRules = new Intl.PluralRules(locale, { type: "cardinal" });

		if(condensed.internals) this.internals = parseInternals(condensed.internals)

        return <Dictionary><unknown>new Proxy(translation, {
            get: (target, prop, receiver) => {
                if (prop in this) {
                    return Reflect.get(this, prop, receiver);
                }
                const keys = (prop as string).split('.')
                if (typeof prop === 'string' && keys[0] in this.condensed) {
                    return translator(this, keys);
                }
                return Reflect.get(target, prop, receiver);
            },
            set: (target, prop, value) => {
                if (prop in this) {
                    return Reflect.set(this, prop, value);
                }
                return Reflect.set(target, prop, value);
            }
        });
	}
	missing(keys: string[]) { return reports.missing(this, keys) }
	error(error: string) { return reports.error(this, error) }
}