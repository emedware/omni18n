interface SystemEntry<KeyInfos extends {}, TextInfos extends {}> {
	'.zone': OmnI18n.Zone
	'.keyInfos'?: KeyInfos
	'.textInfos'?: Record<OmnI18n.Locale, TextInfos>
}

export type JsonDictionaryEntry<KeyInfos extends {}, TextInfos extends {}> = {
	[k: Exclude<OmnI18n.Locale, keyof SystemEntry<KeyInfos, TextInfos>>]: string
} & SystemEntry<KeyInfos, TextInfos>

export type JsonDictionary<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	[key: string]: JsonDictionaryEntry<KeyInfos, TextInfos>
}

export default class JsonDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	implements OmnI18n.InteractiveDB<KeyInfos, TextInfos>
{
	constructor(public dictionary: JsonDictionary<KeyInfos, TextInfos> = {}) {}

	async list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		const result: OmnI18n.RawDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			if (zone == value['.zone']) {
				let mLocale: OmnI18n.Locale | false = false
				for (const locale in value) {
					if (locales.includes(locale) && (!mLocale || locale.length > mLocale.length))
						mLocale = locale
				}
				if (mLocale !== false) result[key] = value[mLocale]
			}
		})
		return result
	}

	async workList(locales: OmnI18n.Locale[]) {
		const result: OmnI18n.WorkDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			const entry = <OmnI18n.WorkDictionaryEntry<KeyInfos, TextInfos>>{
				zone: value['.zone'],
				locales: {},
				...(value['.keyInfos'] && { infos: value['.keyInfos'] })
			}

			const keys = { ...value, ...value['.textInfos'] }

			for (const locale in keys) {
				if (locales.some((demanded) => locale.startsWith(demanded))) {
					entry.locales[locale] = <OmnI18n.WorkDictionaryText<TextInfos>>{
						...(value[locale] && { text: value[locale] }),
						...(value['.textInfos']?.[locale] && { infos: value['.textInfos'][locale] })
					}
				}
			}
			result[key] = entry
		})
		return result
	}

	async isSpecified(key: string, locales: OmnI18n.Locale[]) {
		return locales.some((locale) => this.dictionary[key]?.[locale])
			? this.dictionary[key]['.keyInfos'] || {}
			: undefined
	}

	async modify(key: string, locale: OmnI18n.Locale, value: string, textInfos?: Partial<TextInfos>) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		if (!/^[\w-]*$/g.test(locale))
			throw new Error(`Bad locale: ${locale} (only letters, digits, "_" and "-" allowed)`)
		this.dictionary[key][locale] = value
		if (textInfos) {
			const tis = <Record<OmnI18n.Locale, TextInfos>>this.dictionary[key]['.textInfos']
			tis[locale] = {
				...tis[locale],
				...textInfos
			}
			for (const ti in textInfos) if (textInfos[ti] === undefined) delete tis[locale][ti]
		}
		return this.dictionary[key]['.zone']
	}

	async key(key: string, zone: string, keyInfos?: Partial<KeyInfos>) {
		const entry = this.dictionary[key] || {},
			ez = entry['.zone']
		if (!/^[\w\-\+\*\.]*$/g.test(key))
			throw new Error(`Bad key-name: ${key} (only letters, digits, "_+-*." allowed)`)
		this.dictionary[key] = <JsonDictionaryEntry<KeyInfos, TextInfos>>{
			...entry,
			...((entry['.keyInfos'] || keyInfos) && {
				'.keyInfos': {
					...(<KeyInfos>entry['.keyInfos']),
					...keyInfos
				}
			}),
			'.zone': zone
		}
		const kis = <KeyInfos>this.dictionary[key]['.keyInfos']
		if (kis)
			for (const ki in keyInfos) if (keyInfos[ki] === undefined) delete kis[ki as keyof KeyInfos]
		return zone !== ez
	}

	async remove(key: string) {
		const rv = {
			locales: Object.keys(this.dictionary[key] || {}),
			zone: this.dictionary[key]['.zone']
		}
		delete this.dictionary[key]
		return rv
	}

	async get(key: string) {
		return Object.fromEntries(
			Object.entries(this.dictionary[key]).filter(([k]) => !k.startsWith('.'))
		)
	}
}
