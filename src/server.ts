/// <reference path="./geni18n.d.ts" />

type CDic = GenI18n.CondensedDictionary
type CDicE = CDic & string

/**
 * Abstract file used between the http layer and the database
 */

export interface DB<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	/**
	 * Retrieves all the values for a certain locale
	 * @param locale A language and perhaps a country
	 */
	list(locale: GenI18n.LocaleName, zones: string[]): Promise<GenI18n.RawDictionary>
}

export interface InteractiveDB<KeyInfos extends {} = {}, TextInfos extends {} = {}>
	extends DB<KeyInfos, TextInfos> {
	/**
	 * Checks if a key is specified in a certain locale
	 * @param key The key to search for
	 * @param locales The locales to search in
	 */
	isSpecified(key: string, locales: GenI18n.LocaleName[]): Promise<undefined | {} | TextInfos>

	/**
	 * Modifies/add the value for the key [key, locale]
	 * Note: checks that the key exists
	 * @param key string key
	 * @param locale A language and perhaps a country
	 * @param text A text value
	 * @returns The zone where the key is stored or false if no change were brought
	 */
	modify(
		key: string,
		locale: GenI18n.LocaleName,
		text: string,
		textInfos?: Partial<TextInfos>
	): Promise<string | false>

	/**
	 * Creates or modifies a key
	 * @param key The key to manipulate
	 * @param zone The zone to create the key in, or undefined to delete it
	 * @returns The locales where the key was translated
	 */
	key(key: string, zone: string, keyInfos?: Partial<KeyInfos>): Promise<void>

	/**
	 * Removes a key (and all its translations)
	 * @param key The key to remove
	 * @returns The zone where the key was stored and the locales where it was translated
	 */
	remove(key: string): Promise<{ zone: string; locales: GenI18n.LocaleName[] }>
}

function localeTree(locale: GenI18n.LocaleName) {
	const parts = locale.split('-')
	return parts.map((_, i) => parts.slice(0, i + 1).join('-'))
}

/**
 * Server class that should be instantiated once and used to interact with the database
 */
export default class I18nServer<KeyInfos extends {} = {}, TextInfos extends {} = {}> {
	constructor(protected db: DB<KeyInfos, TextInfos>) {
		this.condense = this.condense.bind(this)
	}

	list(locale: GenI18n.LocaleName, zones: string[] = ['']): Promise<GenI18n.RawDictionary> {
		return this.db.list(locale, zones)
	}
	/**
	 * Used by APIs or page loaders to get the dictionary in a condensed form
	 * @param locale
	 * @param zone
	 * @returns
	 */
	async condense(locale: GenI18n.LocaleName, zones: string[] = ['']): Promise<CDic> {
		const parts = locale.split('-'),
			raws = await Promise.all([
				this.list('', zones),
				...localeTree(locale).map((subLocale) => this.list(subLocale, zones))
			]),
			result: CDic = {}
		for (const raw of raws) {
			for (const key in raw) {
				const value = raw[key],
					keys = key.split('.'),
					lastKey = keys.pop() as string
				let current = result
				for (const k of keys) {
					if (!current[k]) current[k] = <CDicE>{}
					else if (typeof current[k] === 'string') current[k] = <CDicE>{ '': <string>current[k] }
					current = current[k] as CDic
				}
				if (current[lastKey] && typeof current[lastKey] !== 'string')
					(<CDic>current[lastKey])[''] = value
				else current[lastKey] = <CDicE>value
			}
		}
		return result
	}
}

const subscriptions = new Map<
	InteractiveServer,
	{
		locale: GenI18n.LocaleName
		zones: string[]
	}
>()

/**
 * Instance of a server who raises events when the dictionary is modified
 */
export class InteractiveServer<
	KeyInfos extends {} = {},
	TextInfos extends {} = {}
> extends I18nServer<KeyInfos, TextInfos> {
	modifiedValues: Record<string, string | undefined> = {}
	modifications: [string, GenI18n.LocaleName, string, string | undefined][] = []

	constructor(
		protected db: InteractiveDB,
		private modified: (entries: Record<string, string | undefined>) => Promise<void>
	) {
		super(db)
		subscriptions.set(this, { locale: '', zones: [] })
	}

	isSpecified(key: string, locales: GenI18n.LocaleName[]): Promise<undefined | {} | TextInfos> {
		return this.db.isSpecified(key, locales)
	}

	async save() {
		const servers = new Set<InteractiveServer>()
		for (const [key, locale, zone, text] of this.modifications) {
			for (const [server, specs] of subscriptions.entries()) {
				// find all the locales the server use who are descendant of the modified locale
				// example: locale = 'fr' & specs.locale = 'fr-BE-WA': avoid raising if the key is present in 'fr-BE' and 'fr-BE-WA'
				if (
					specs.zones.includes(zone) &&
					specs.locale.startsWith(locale) &&
					!(await this.db.isSpecified(
						key,
						localeTree(specs.locale.substring(locale.length + 1)).map(
							(subLocale) => `${locale}-${subLocale}`
						)
					))
				) {
					server.modifiedValues[key] = text
					servers.add(server)
				}
			}
		}
		this.modifications = []
		return Promise.all(Array.from(servers.entries()).map(([server]) => server.raiseOneModified()))
	}

	async raiseOneModified() {
		if (Object.keys(this.modifiedValues).length) await this.modified(this.modifiedValues)
		this.modifiedValues = {}
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
	condense(locale: string, zones?: string[]): Promise<CDic> {
		const sub = subscriptions.get(this)
		if (sub) {
			sub.locale = locale
			sub.zones = [...sub.zones, ...(zones || [])]
		}
		return super.condense(locale, zones)
	}

	/**
	 * Modifies the text for the key [key, locale]
	 * Called by translators
	 * @param key string key
	 * @param locale A language and perhaps a country
	 * @param text A text value
	 */
	async modify(
		key: string,
		locale: GenI18n.LocaleName,
		text: string,
		textInfos?: Partial<TextInfos>
	): Promise<string | false> {
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
		key: string,
		zone: string,
		translations: Record<GenI18n.LocaleName, string> = {},
		keyInfos?: Partial<KeyInfos>,
		textInfos?: Partial<TextInfos>
	): Promise<void> {
		await this.db.key(key, zone, keyInfos)
		await Promise.all(
			Object.entries(translations).map(([locale, value]) =>
				this.modify(key, locale, value, textInfos)
			)
		)
	}
	async remove(key: string): Promise<void> {
		const { zone, locales } = await this.db.remove(key)
		for (const locale of locales) this.modifications.push([key, locale, zone, undefined])
	}
}
