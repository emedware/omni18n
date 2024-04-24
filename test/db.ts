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
