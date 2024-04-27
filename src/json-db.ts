interface SystemEntry<KeyInfos extends {}, TextInfos extends {}> {
	'.zone': OmnI18n.Zone
	'.keyInfos'?: KeyInfos
	'.textInfos'?: Record<OmnI18n.Locale, TextInfos>
}

export type JsonDictionaryEntry<KeyInfos extends {}, TextInfos extends {}> = Record<
	Exclude<OmnI18n.Locale, keyof SystemEntry<KeyInfos, TextInfos>>,
	string
> &
	SystemEntry<KeyInfos, TextInfos>

export type JsonDictionary<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	[key: string]: JsonDictionaryEntry<KeyInfos, TextInfos>
}

export default class JsonDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	implements OmnI18n.InteractiveDB<KeyInfos, TextInfos>
{
	constructor(public dictionary: JsonDictionary<KeyInfos, TextInfos> = {}) {}

	async isSpecified(key: string, locales: OmnI18n.Locale[]) {
		return locales.some((locale) => this.dictionary[key]?.[locale])
			? this.dictionary[key]['.keyInfos'] || {}
			: undefined
	}

	async modify(key: string, locale: OmnI18n.Locale, value: string, textInfos?: Partial<TextInfos>) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
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

	async list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		const result: OmnI18n.RawDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			if (zone == value['.zone']) {
				let mLocale: OmnI18n.Locale | false = false,
					mText: string
				for (const locale in value) {
					if (locales.includes(locale) && (!mLocale || locale.length > mLocale.length))
						mLocale = locale
				}
				if (mLocale !== false) result[key] = value[mLocale]
			}
		})
		return result
	}

	async get(key: string) {
		return Object.fromEntries(
			Object.entries(this.dictionary[key]).filter(([k]) => !k.startsWith('.'))
		)
	}
}
