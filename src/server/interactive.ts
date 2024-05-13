import {
	WorkDictionary,
	type CondensedDictionary,
	type InteractiveDB,
	type Locale,
	type TextKey,
	type Translation,
	type Zone
} from '../types'
import I18nServer, { localeTree } from './server'

const subscriptions = new Map<
	InteractiveServer,
	{
		locale: Locale
		zones: Zone[]
	}
>()

export type Modification = [TextKey, Locale, Zone, Translation | undefined, ...([] | [Locale[]])]

/**
 * Instance of a server who raises events when the dictionary is modified
 */
export default class InteractiveServer<
	KeyInfos extends {} = {},
	TextInfos extends {} = {}
> extends I18nServer<KeyInfos, TextInfos> {
	modifiedValues: Record<TextKey, Translation | undefined> = {}
	modifications: Modification[] = []

	constructor(
		protected db: InteractiveDB,
		private modified = (entries: Record<TextKey, Translation | undefined>) => Promise.resolve()
	) {
		super(db)
		subscriptions.set(this, { locale: '', zones: [] })
	}

	workList(locales: Locale[]): Promise<WorkDictionary> {
		return this.db.workList(locales)
	}

	async propagate() {
		const servers = new Set<InteractiveServer>()
		for (const [key, locale, zone, text, locales] of this.modifications) {
			for (const [server, specs] of subscriptions.entries()) {
				// find all the locales the server use who are descendant of the modified locale
				// example: locale = 'fr' & specs.locale = 'fr-BE-WA': avoid raising if the key is present in 'fr-BE' and 'fr-BE-WA'
				const rightPart = specs.locale.substring(locale.length + 1),
					testLocales = rightPart
						? localeTree(rightPart).map((subLocale) => `${locale}-${subLocale}`)
						: false
				if (
					specs.zones.includes(zone) &&
					specs.locale.startsWith(locale) &&
					(!testLocales ||
						(locales
							? !locales.some((testLocale) => testLocales.includes(testLocale))
							: (await this.db.getZone(key, testLocales)) === false))
				) {
					server.modifiedValues[key] = text
					servers.add(server)
				}
			}
		}
		this.modifications = []
		return Promise.all(Array.from(servers.entries()).map(([server]) => server.raiseOneModified()))
	}

	private async raiseOneModified() {
		const modifiedValues = this.modifiedValues
		this.modifiedValues = {}
		if (Object.keys(modifiedValues).length) await this.modified(modifiedValues)
	}

	async modifiedKey(key: TextKey, zone: Zone) {
		const translations = await this.db.get(key)
		this.modifications.push(
			...Object.entries(translations).map(
				([locale, text]) => [key, locale, zone, text] as Modification
			)
		)
	}

	async modifiedText(key: TextKey, locale: Locale, text?: Translation) {
		const zone = await this.db.getZone(key)
		this.modifications.push([key, locale, zone, text] as Modification)
	}

	destroy() {
		subscriptions.delete(this)
	}

	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * This version modifies the subscription for events
	 * @param locale
	 * @param zone
	 * @returns
	 */
	condense(locales: Locale[], zones?: Zone[]): Promise<CondensedDictionary[]> {
		const sub = subscriptions.get(this)
		if (sub) {
			sub.locale = locales[0]
			sub.zones = [...sub.zones, ...(zones || [])]
		}
		return super.condense(locales, zones)
	}

	/**
	 * Modifies the text for the key [key, locale]
	 * Called by translators
	 * @param key text key
	 * @param locale A language and perhaps a country
	 * @param text A text value
	 */
	async modify(
		key: TextKey,
		locale: Locale,
		text: Translation,
		textInfos?: Partial<TextInfos>
	): Promise<Zone | false> {
		const zone = await this.db.modify(key, locale, text, textInfos)
		if (zone !== false) this.modifications.push([key, locale, zone, text])
		return zone
	}
	/**
	 * Modify/creates a key
	 * Called by developers
	 * @param key
	 * @param zone
	 * @param translations
	 * @param args
	 */
	async key(
		key: TextKey,
		zone: Zone,
		translations: Record<Locale, Translation> = {},
		keyInfos?: Partial<KeyInfos>,
		textInfos?: Partial<TextInfos>
	): Promise<void> {
		const keyModified = await this.db.key(key, zone, keyInfos)
		if (keyModified) {
			for (const [locale, text] of Object.entries({
				...(await this.db.get(key)),
				...translations
			}))
				this.modifications.push([key, locale, zone, text])
		}
		await Promise.all(
			Object.entries(translations).map(async ([locale, text]) => {
				if ((await this.db.modify(key, locale, text, textInfos)) !== false && !keyModified)
					this.modifications.push([key, locale, zone, text])
			})
		)
	}
	async reKey(key: TextKey, newKey?: TextKey): Promise<void> {
		const { zone, texts } = await this.db.reKey(key, newKey)
		for (const locale in texts) {
			this.modifications.push([key, locale, zone, undefined, Object.keys(texts)])
			if (newKey) this.modifications.push([newKey, locale, zone, texts[locale]])
		}
	}
}
