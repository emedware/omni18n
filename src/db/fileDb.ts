import JsonDB, { JsonDictionary, JsonDictionaryEntry } from './jsonDb'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { parse, stringify } from 'hjson'
import Defer from '../defer'

function rexCount(str: string, position: number, rex: RegExp = /\u0000/g) {
	let count = 0,
		fetch: RegExpExecArray | null

	while ((fetch = rex.exec(str)) && fetch.index < position) count++
	return count
}

export default class FileDB<KeyInfos extends {}, TextInfos extends {}> extends JsonDB<
	KeyInfos,
	TextInfos
> {
	private save: Defer
	public readonly loaded: Promise<void>
	constructor(
		private path: string,
		saveDelay = 1e4 // 10 seconds
	) {
		super()
		this.loaded = this.reload()
		this.save = new Defer(
			async () => await writeFile(this.path, FileDB.serialize(this.dictionary), 'utf16le'),
			saveDelay
		)
	}

	async reload() {
		// In case of too much time, write the "modified" call
		const fStat = await stat(this.path)
		if (fStat.isFile() && fStat.size > 0) {
			const data = await readFile(this.path, 'utf16le')
			this.dictionary = JSON.parse(data)
		}
	}

	async list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		await this.loaded
		return super.list(locales, zone)
	}
	async workList(locales: string[]): Promise<OmnI18n.WorkDictionary> {
		await this.loaded
		return super.workList(locales)
	}
	async isSpecified(key: string, locales: OmnI18n.Locale[]) {
		await this.loaded
		return super.isSpecified(key, locales)
	}
	async modify(key: string, locale: OmnI18n.Locale, value: string) {
		await this.loaded
		this.save.defer()
		return super.modify(key, locale, value)
	}
	async key(key: string, zone: string) {
		await this.loaded
		this.save.defer()
		return super.key(key, zone)
	}
	async remove(key: string) {
		await this.loaded
		this.save.defer()
		return super.remove(key)
	}
	async get(key: string) {
		await this.loaded
		return super.get(key)
	}

	//#region serialization

	static serialize<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
		dictionary: JsonDictionary<KeyInfos, TextInfos>
	) {
		function optioned(obj: any, preTabs = 0) {
			const stringified = stringify(obj, {
				bracesSameLine: true,
				multiline: 'std',
				space: '\t'
			})
			return stringified.length < 80
				? stringified.replace(/[\n\t]/g, '')
				: preTabs
					? stringified.replace(/\n/g, '\n' + '\t'.repeat(preTabs))
					: stringified
		}
		let rv = ''
		for (const [key, value] of Object.entries(dictionary)) {
			const ti = value['.textInfos']
			rv +=
				key.replace(/:/g, '::') +
				(value['.keyInfos'] ? optioned(value['.keyInfos']) : '') +
				':' +
				value['.zone'] +
				'\n' +
				Object.entries(value)
					.filter(([k]) => !k.startsWith('.'))
					.map(
						([k, v]) =>
							'\t' +
							k +
							(ti?.[k] ? optioned(ti[k], 1) : '') +
							':' +
							v.replace(/\n/g, '\n\t\t') +
							'\n'
					)
					.join('')
			if (ti)
				rv += Object.entries(ti)
					.filter(([k]) => !(k in value))
					.map(([k, v]) => '\t' + k + optioned(v, 1) + '\n')
					.join('')
		}
		return rv
	}

	static deserialize<KeyInfos extends {} = {}, TextInfos extends {} = {}>(data: string) {
		const dictionary: JsonDictionary<KeyInfos, TextInfos> = {}
		data = data.replace(/\n/gm, '\u0000')
		const rex = {
			key: /([^\t\{:]+)(\{.*?\})?:([^\u0000]*)\u0000/g,
			locale: /\t([^\t\{:]*)(\{.*?\})?(?::((?:[^\u0000]|\u0000\t\t)*))?\u0000/g
		}
		let keyFetch: RegExpExecArray | null
		let lastIndex = 0
		while ((keyFetch = rex.key.exec(data))) {
			if (keyFetch.index > lastIndex)
				throw new Error(
					`Unparsable data at line ${rexCount(data, rex.key.lastIndex)}: ${data.slice(lastIndex, keyFetch.index)}`
				)
			const key = keyFetch[1],
				zone = keyFetch[3] as OmnI18n.Zone
			let keyInfos: any,
				textInfos: Record<OmnI18n.Locale, any> = {}
			if (keyFetch[2]) keyInfos = parse(keyFetch[2].replace(/\u0000/g, '\n'))
			const entry: JsonDictionaryEntry<KeyInfos, TextInfos> = {
				'.zone': zone,
				...(keyInfos && { '.keyInfos': keyInfos })
			}
			let localeFetch: RegExpExecArray | null
			rex.locale.lastIndex = lastIndex = rex.key.lastIndex
			while ((localeFetch = rex.locale.exec(data))) {
				if (localeFetch.index > lastIndex) break
				lastIndex = rex.locale.lastIndex
				if (localeFetch[3])
					entry[localeFetch[1] as OmnI18n.Locale] = localeFetch[3].replace(/\u0000\t\t/g, '\n')
				if (localeFetch[2])
					textInfos[localeFetch[1] as OmnI18n.Locale] = parse(
						localeFetch[2].replace(/\u0000/g, '\n')
					)
			}
			rex.key.lastIndex = lastIndex
			if (Object.keys(textInfos).length) entry['.textInfos'] = textInfos
			dictionary[key] = entry
		}
		if (rex.key.lastIndex > 0 || !rex.key.test(data))
			throw new Error(
				`Unparsable data at line ${rexCount(data, rex.key.lastIndex)}: ${data.slice(rex.key.lastIndex, 100)}`
			)
		return dictionary
	}

	//#endregion
}
