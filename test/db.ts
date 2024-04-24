import { InteractiveDB } from '../src/server'

export const Zone = Symbol('Zone')

function waiter(funcs: Record<string, (...args: any[]) => any>) {
	return Object.fromEntries(
		Object.entries(funcs).map(([key, func]) => [
			key,
			(...args) => new Promise((resolve) => setTimeout(() => resolve(func(...args)), 1))
		])
	)
}

export function directMem(
	dictionary: { [key: string]: { [locale: string]: string; [Zone]: string } } = {}
) {
	return <InteractiveDB>(<unknown>waiter({
		isSpecified(key: string, locales: Geni18n.LocaleName[]) {
			return locales.some((locale) => dictionary[key]?.[locale])
		},
		modify(key: string, locale: Geni18n.LocaleName, value: string) {
			if (!dictionary[key]) throw new Error(`Key "${key}" not found`)
			dictionary[key][locale] = value
			return dictionary[key][Zone]
		},
		key(key: string, zone: string, ...args: any[]) {
			if (key in dictionary) dictionary[key][Zone] = zone
			else dictionary[key] = { [Zone]: zone }
		},
		remove(key: string) {
			const rv = {
				locales: Object.keys(dictionary[key] || {}),
				zone: dictionary[key][Zone]
			}
			delete dictionary[key]
			return rv
		},
		list(locale: Geni18n.LocaleName, zones: string[]) {
			const result: Geni18n.RawDictionary = {}
			Object.entries(dictionary).forEach(([key, value]) => {
				if (zones.includes(value[Zone]) && value[locale]) {
					result[key] = value[locale]
				}
			})
			return result
		}
	}))
}
const dic = {
	'fld.name': { en: 'Name', fr: 'Nom', [Zone]: '' },
	'fld.bdate': { en: 'Birthday', fr: 'Date de naissance', [Zone]: '' },
	'fld.bdate.short': { en: 'B-dy', [Zone]: '' },
	'msg.greet': {
		en: 'Hello {0|here}',
		fr: 'Salut {0|tout le monde}',
		'fr-BE': "Salut {0|m'fi",
		[Zone]: ''
	},
	'cmd.ban': { en: 'Ban user', fr: "Bannir l'utilisateur", [Zone]: 'adm' },
	'specs.animal': {
		en: '{0} {plural|$0|ox|oxen}',
		fr: '{0} {plural|$0|one:cheval,other:chevaux}',
		[Zone]: ''
	},
	'specs.cat': { en: '{0} {plural|$0|cat}', fr: '{0} {plural|$0|chat}', [Zone]: '' },
	'specs.number': { '': '{number|$0}', [Zone]: '' },
	'specs.price': { '': '{number|$1|style: currency, currency: $0}', [Zone]: '' },
	'specs.ordinal': { '': '{ordinal|$0}', [Zone]: '' },
	'internals.ordinals': {
		en: "{one: '$st', two: '$nd', few: '$rd', other: '$th'}",
		fr: "{one: '$er', other: '$ème'}",
		[Zone]: ''
	},
	'internals.plurals': { en: "{one: '$', other: '$s'}", fr: "{one: '$', other: '$s'}", [Zone]: '' }
}
