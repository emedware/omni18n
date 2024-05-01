interface SystemEntry<KeyInfos extends {}, TextInfos extends {}> {
	'.zone'?: OmnI18n.Zone
	'.keyInfos'?: KeyInfos
	'.textInfos'?: Record<OmnI18n.Locale, TextInfos>
}

export type MemDBDictionaryEntry<KeyInfos extends {}, TextInfos extends {}> = {
	[k in Exclude<OmnI18n.Locale, keyof SystemEntry<KeyInfos, TextInfos>>]?: OmnI18n.Translation
} & SystemEntry<KeyInfos, TextInfos>

export type MemDBDictionary<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	[key in OmnI18n.TextKey]: MemDBDictionaryEntry<KeyInfos, TextInfos>
}

export default class MemDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	implements OmnI18n.InteractiveDB<KeyInfos, TextInfos>
{
	constructor(public dictionary: MemDBDictionary<KeyInfos, TextInfos> = {}) {}

	async list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		const result: OmnI18n.RawDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			if (zone == value['.zone'] || (!zone && !value['.zone'])) {
				const locale = locales.find((locale) => locale in value)
				if (locale !== undefined) result[key] = [locale, value[locale]!]
			}
		})
		return result
	}

	async workList(locales: OmnI18n.Locale[]) {
		const result: OmnI18n.WorkDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			const entry: OmnI18n.WorkDictionaryEntry<KeyInfos, TextInfos> = {
				zone: value['.zone'] || '',
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

	async getZone(key: OmnI18n.TextKey, locales?: OmnI18n.Locale[]) {
		if (!this.dictionary[key]) return false
		const zone = this.dictionary[key]['.zone']
		return !locales || locales.some((locale) => this.dictionary[key]?.[locale]) ? zone || '' : false
	}

	async modify(
		key: OmnI18n.TextKey,
		locale: OmnI18n.Locale,
		value: OmnI18n.Translation,
		textInfos?: Partial<TextInfos>
	) {
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
		return this.dictionary[key]['.zone'] || ''
	}

	async key(key: OmnI18n.TextKey, zone: OmnI18n.Zone, keyInfos?: Partial<KeyInfos>) {
		const entry = this.dictionary[key] || {},
			ez = entry['.zone']
		if (!/^[\w\-\+\*\.]*$/g.test(key))
			throw new Error(`Bad key-name: ${key} (only letters, digits, "_+-*." allowed)`)
		this.dictionary[key] = <MemDBDictionaryEntry<KeyInfos, TextInfos>>{
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

	async reKey(key: OmnI18n.TextKey, newKey?: OmnI18n.TextKey) {
		const rv = {
			locales: Object.keys(this.dictionary[key] || {}),
			zone: this.dictionary[key]['.zone'] || ''
		}
		if (newKey) this.dictionary[newKey] = this.dictionary[key]
		delete this.dictionary[key]
		return rv
	}

	async get(key: OmnI18n.TextKey) {
		return Object.fromEntries(
			Object.entries(this.dictionary[key]).filter(([k]) => !k.startsWith('.'))
		) as Record<OmnI18n.Locale, OmnI18n.Translation>
	}
}
