import {
	WorkDictionary,
	WorkDictionaryEntry,
	WorkDictionaryText,
	type Locale,
	type TextKey,
	type Translation,
	type Zone
} from '../types'
import { type InteractiveDB, type RawDictionary } from './types'

interface SystemEntry<KeyInfos extends {}, TextInfos extends {}> {
	'.zone'?: Zone
	'.keyInfos'?: KeyInfos
	'.textInfos'?: Record<Locale, TextInfos>
}

export type MemDBDictionaryEntry<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	[k in Exclude<Locale, keyof SystemEntry<KeyInfos, TextInfos>>]?: Translation
} & SystemEntry<KeyInfos, TextInfos>

export type MemDBDictionary<KeyInfos extends {} = {}, TextInfos extends {} = {}> = {
	[key in TextKey]: MemDBDictionaryEntry<KeyInfos, TextInfos>
}

export default class MemDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	implements InteractiveDB<KeyInfos, TextInfos>
{
	constructor(public dictionary: MemDBDictionary<KeyInfos, TextInfos> = {}) {}

	async list(locales: Locale[], zone: Zone) {
		const result: RawDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			if (zone == value['.zone'] || (!zone && !value['.zone'])) {
				const locale = locales.find((locale) => locale in value)
				if (locale !== undefined) result[key] = [locale, value[locale]!]
			}
		})
		return result
	}

	async workList(locales: Locale[]) {
		const result: WorkDictionary = {}
		Object.entries(this.dictionary).forEach(([key, value]) => {
			const entry: WorkDictionaryEntry<KeyInfos, TextInfos> = {
				zone: value['.zone'] || '',
				texts: {},
				...(value['.keyInfos'] && { infos: value['.keyInfos'] })
			}

			const keys = { ...value, ...value['.textInfos'] }

			for (const locale in keys) {
				if (locales.some((demanded) => locale.startsWith(demanded))) {
					entry.texts[locale] = <WorkDictionaryText<TextInfos>>{
						...(value[locale] && { text: value[locale] }),
						...(value['.textInfos']?.[locale] && { infos: value['.textInfos'][locale] })
					}
				}
			}
			result[key] = entry
		})
		return result
	}

	async getZone(key: TextKey, locales?: Locale[]) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		if (!this.dictionary[key]) return false
		const zone = this.dictionary[key]['.zone']
		return !locales || locales.some((locale) => this.dictionary[key][locale] !== undefined)
			? zone || ''
			: false
	}

	async modify(key: TextKey, locale: Locale, value: Translation, textInfos?: Partial<TextInfos>) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		if (!/^[\w-]*$/g.test(locale))
			throw new Error(`Bad locale: ${locale} (only letters, digits, "_" and "-" allowed)`)
		this.dictionary[key][locale] = value
		if (textInfos) {
			const tis = <Record<Locale, TextInfos>>this.dictionary[key]['.textInfos']
			tis[locale] = {
				...tis[locale],
				...textInfos
			}
			for (const ti in textInfos) if (textInfos[ti] === undefined) delete tis[locale][ti]
		}
	}

	async key(key: TextKey, zone: Zone, keyInfos?: Partial<KeyInfos>) {
		const entry = this.dictionary[key] || {},
			ez = entry['.zone']
		if (!/^[\w\-\+\*\.]*$/g.test(key) || `.${key}.`.includes('.then.'))
			throw new Error(
				`Bad key-name: ${key} (only letters, digits, "_+-*." allowed) (and no "then" part)`
			)
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

	async reKey(key: TextKey, newKey?: TextKey) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		if (newKey && this.dictionary[newKey]) throw new Error(`Key "${newKey}" already exists`)
		const rv = {
			texts: Object.fromEntries(
				Object.entries(this.dictionary[key] || {}).filter(([k]) => !k.startsWith('.'))
			) as Record<Locale, Translation>,
			zone: this.dictionary[key]['.zone'] || ''
		}
		if (newKey) this.dictionary[newKey] = this.dictionary[key]
		delete this.dictionary[key]
		return rv
	}

	async get(key: TextKey) {
		if (!this.dictionary[key]) throw new Error(`Key "${key}" not found`)
		return Object.fromEntries(
			Object.entries(this.dictionary[key]).filter(([k]) => !k.startsWith('.'))
		) as Record<Locale, Translation>
	}
}
