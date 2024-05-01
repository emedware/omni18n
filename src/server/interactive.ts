import I18nServer, { localeTree } from './server'

const subscriptions = new Map<
	InteractiveServer,
	{
		locale: OmnI18n.Locale
		zones: OmnI18n.Zone[]
	}
>()

export type Modification = [
	OmnI18n.TextKey,
	OmnI18n.Locale,
	OmnI18n.Zone,
	OmnI18n.Translation | undefined
]

/**
 * Instance of a server who raises events when the dictionary is modified
 */
export default class InteractiveServer<
	KeyInfos extends {} = {},
	TextInfos extends {} = {}
> extends I18nServer<KeyInfos, TextInfos> {
	modifiedValues: Record<OmnI18n.TextKey, [OmnI18n.Translation, OmnI18n.Zone] | undefined> = {}
	modifications: Modification[] = []

	constructor(
		protected db: OmnI18n.InteractiveDB,
		private modified = (
			entries: Record<OmnI18n.TextKey, [OmnI18n.Translation, OmnI18n.Zone] | undefined>
		) => Promise.resolve()
	) {
		super(db)
		subscriptions.set(this, { locale: '', zones: [] })
	}

	workList(locales: OmnI18n.Locale[]): Promise<OmnI18n.WorkDictionary> {
		return this.db.workList(locales)
	}

	async propagate() {
		const servers = new Set<InteractiveServer>()
		for (const [key, locale, zone, text] of this.modifications) {
			for (const [server, specs] of subscriptions.entries()) {
				// find all the locales the server use who are descendant of the modified locale
				// example: locale = 'fr' & specs.locale = 'fr-BE-WA': avoid raising if the key is present in 'fr-BE' and 'fr-BE-WA'
				if (
					specs.zones.includes(zone) &&
					specs.locale.startsWith(locale) &&
					(await this.db.getZone(
						key,
						localeTree(specs.locale.substring(locale.length + 1)).map(
							(subLocale) => `${locale}-${subLocale}`
						)
					)) === false
				) {
					server.modifiedValues[key] = text === undefined ? undefined : [text, zone]
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

	async modifiedKey(key: OmnI18n.TextKey, zone: OmnI18n.Zone) {
		const translations = await this.db.get(key)
		this.modifications.push(
			...Object.entries(translations).map(
				([locale, text]) => [key, locale, zone, text] as Modification
			)
		)
	}

	async modifiedText(key: OmnI18n.TextKey, locale: OmnI18n.Locale, text?: OmnI18n.Translation) {
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
	condense(
		locales: OmnI18n.Locale[],
		zones?: OmnI18n.Zone[]
	): Promise<OmnI18n.CondensedDictionary[]> {
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
		key: OmnI18n.TextKey,
		locale: OmnI18n.Locale,
		text: OmnI18n.Translation,
		textInfos?: Partial<TextInfos>
	): Promise<OmnI18n.Zone | false> {
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
		key: OmnI18n.TextKey,
		zone: OmnI18n.Zone,
		translations: Record<OmnI18n.Locale, OmnI18n.Translation> = {},
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
	async reKey(key: OmnI18n.TextKey, newKey?: OmnI18n.TextKey): Promise<void> {
		const { zone, texts } = await this.db.reKey(key, newKey)
		for (const locale in texts) {
			this.modifications.push([key, locale, zone, undefined])
			if (newKey) this.modifications.push([newKey, locale, zone, texts[locale]])
		}
	}
}
