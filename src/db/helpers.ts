import type { Locale, TextKey, Translation, Zone } from '../types'
import type { MemDBDictionary, MemDBDictionaryEntry } from './memDb'
import type { DB, RawDictionary } from './types'

type KeyRaw<KeyInfos extends {} = {}> = { key: TextKey; zone?: Zone; keyInfos?: KeyInfos }
type TextRaw<TextInfos extends {} = {}> = {
	locale: Locale
	text: Translation
	textInfos?: TextInfos
}

/**
 * Load an in-memory structure out of raw DB output
 * @param raw Raw rows from a DB
 * @param keys If needed, the keys and their information are stored separately.
 * @returns
 */
export function loadDBFromList<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
	raw: Iterable<KeyRaw<KeyInfos> & TextRaw<TextInfos>>,
	keys: Iterable<KeyRaw<KeyInfos>> = []
): MemDBDictionary<KeyInfos, TextInfos> {
	const dictionary: MemDBDictionary<KeyInfos, TextInfos> = {}
	for (const { key, zone, keyInfos } of keys)
		dictionary[key] = {
			'.zone': zone,
			...(keyInfos && { '.keyInfos': keyInfos })
		} as MemDBDictionaryEntry<KeyInfos, TextInfos>
	for (const { key, locale, text, zone, keyInfos, textInfos } of raw) {
		if (key in dictionary) {
			dictionary[key][locale] = text
			if (textInfos) {
				if ('.textInfos' in dictionary[key]) dictionary[key]['.textInfos']![locale] = textInfos
				else dictionary[key]['.textInfos'] = { [locale]: textInfos }
			}
		} else
			dictionary[key] = {
				[locale]: text,
				'.zone': zone ?? '',
				...(textInfos && { '.textInfos': { [locale]: textInfos } }),
				...(keyInfos && { '.keyInfos': keyInfos })
			} as MemDBDictionaryEntry<KeyInfos, TextInfos>
	}
	return dictionary
}

/**
 * Load an in-memory structure out of raw DB output
 * @param translations The list of translation files (recorded per locale)
 * @returns
 */
export function loadDBFromTranslations<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
	translations: Record<Locale, Record<TextKey, Translation>>
): MemDBDictionary<KeyInfos, TextInfos> {
	function* flatten(): Iterable<KeyRaw<KeyInfos> & TextRaw<TextInfos>> {
		for (const locale in translations)
			for (const key in translations[locale]) yield { key, locale, text: translations[locale][key] }
	}
	return loadDBFromList(flatten())
}

/**
 * Because a request retrieving "the first locale from a given list" might get really complex with some engines
 * So, instead of implementing `DB` directly, `SimplifiedDB` can be extended by providing a `listLocale` function
 *
 * The list function will simply retrieve all the zone/locale keys/text with one query per locale and sort them
 *  programmatically
 */
export abstract class SimplifiedMultiQueryDB implements DB {
	/**
	 * Retrieves all the values for a certain zone and a certain locales
	 * @param locale The locale to search for
	 * @param zone The zone to search in
	 * @param exclusion A list of keys to exclude
	 * @returns A dictionary of key => text
	 */
	abstract listLocale(
		locale: Locale,
		zone: Zone,
		exclusion: TextKey[]
	): Promise<[TextKey, Translation][]>
	async list(locales: Locale[], zone: Zone) {
		const rv: RawDictionary = {}
		for (const locale of locales)
			for (const [key, text] of await this.listLocale(locale, zone, Object.keys(rv)))
				if (!rv[key]) rv[key] = [locale, text]
		return rv
	}
}

/**
 * Because a request retrieving "the first locale from a given list" might get really complex with some engines
 * So, instead of implementing `DB` directly, `SimplifiedDB` can be extended by providing a `listLocale` function
 *
 * The list function will simply retrieve all the zone/locale keys/text for all locales and sort/group them programmatically
 */
export abstract class SimplifiedSingleQueryDB implements DB {
	/**
	 * Retrieves all the values for a certain zone and a certain locales
	 * @param locales A list of locales to search for
	 * @param zone The zone to search in
	 * @returns A dictionary of key => text
	 */
	abstract exhaustiveList(locales: Locale[], zone: Zone): Promise<[Locale, TextKey, Translation][]>
	/**
	 * Call this function if this was not done in the query: if locales are [l1, l2, ...], make sure that all the l1 appear first, then the l2, ...
	 * @param locales The given list of locale priority
	 * @param exhaustive The exhaustive list of unsorted [Locale, TextKey, Translation]
	 */
	sortByLocales(
		locales: Locale[],
		exhaustive: [Locale, TextKey, Translation][]
	): [Locale, TextKey, Translation][] {
		const order: Record<Locale, number> = locales.reduce((p, c, i) => ({ ...p, [c]: i }), {})
		return exhaustive.sort((a, b) => order[a[0]] - order[b[0]])
	}
	async list(locales: Locale[], zone: Zone) {
		const rv: RawDictionary = {}
		for (const [locale, key, text] of await this.exhaustiveList(locales, zone))
			if (!rv[key]) rv[key] = [locale, text]
		return rv
	}
}
