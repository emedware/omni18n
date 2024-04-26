import { InteractiveDB } from '../src/server'

export type JsonDictionaryEntry<KeyInfos extends {} = {}, TextInfos extends {} = {}> =
	| Record<GenI18n.LocaleName, string>
	| {
			'.zone': GenI18n.Zone
			'.keyInfos'?: KeyInfos
			'.textInfos'?: Record<GenI18n.LocaleName, TextInfos>
	  }

export type JsonDictionary<KeyInfos extends {} = {}> = {
	[key: string]: JsonDictionaryEntry<KeyInfos>
}

export default class JsonDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	implements InteractiveDB<KeyInfos, TextInfos>
{
	constructor(public dictionary: JsonDictionary = {}) {}

	async isSpecified(key: string, locales: GenI18n.LocaleName[]) {
		return locales.some((locale) => this.dictionary[key]?.[locale])
			? this.dictionary[key]['.keyInfos'] || {}
			: undefined
	}

	async modify(
		key: string,
		locale: GenI18n.LocaleName,
		value: string,
		textInfos?: Partial<TextInfos>
	) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		this.dictionary[key][locale] = value
		if (textInfos) {
			const tis = <Record<GenI18n.LocaleName, TextInfos>>this.dictionary[key]['.textInfos']
			tis[locale] = {
				...tis[locale],
				...textInfos
			}
			for (const ti in textInfos) if (textInfos[ti] === undefined) delete tis[locale][ti]
		}
		return this.dictionary[key]['.zone']
	}

	async key(key: string, zone: string, keyInfos?: Partial<KeyInfos>) {
		const entry = this.dictionary[key] || {}
		this.dictionary[key] = {
			...entry,
			...((entry['.keyInfos'] || keyInfos) && {
				'.keyInfos': {
					...(<KeyInfos>entry['.keyInfos']),
					...keyInfos
				}
			}),
			'.zone': zone
		}
		for (const ki in keyInfos)
			if (keyInfos[ki] === undefined) delete entry['.keyInfos']?.[ki as string]
	}

	async remove(key: string) {
		const rv = {
			locales: Object.keys(this.dictionary[key] || {}),
			zone: this.dictionary[key]['.zone']
		}
		delete this.dictionary[key]
		return rv
	}

	async list(locale: GenI18n.LocaleName, zones: string[]) {
		const result: GenI18n.RawDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			if (zones.includes(value['.zone']) && value[locale]) {
				result[key] = value[locale]
			}
		})
		return result
	}
}
