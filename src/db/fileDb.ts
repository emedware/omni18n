import { parse, stringify } from 'hjson'
import { readFile, stat, writeFile } from 'node:fs/promises'
import Defer from '../defer'
import { WorkDictionary, type Locale, type TextKey, type Translation, type Zone } from '../types'
import MemDB, { MemDBDictionary, MemDBDictionaryEntry } from './memDb'

function parseError(str: string, position: number, end: number = position + 100) {
	let count = 0,
		fetch: RegExpExecArray | null

	while ((fetch = /\u0000/g.exec(str)) && fetch.index < position) count++
	return new Error(`Unparsable data at line ${count}: ${str.slice(position, end)}`)
}

export default class FileDB<KeyInfos extends {}, TextInfos extends {}> extends MemDB<
	KeyInfos,
	TextInfos
> {
	private saving: Defer
	public readonly loaded: Promise<void>
	constructor(
		private path: string,
		saveDelay = 1e3 // 1 second
	) {
		super()
		this.loaded = this.reload()
		this.saving = new Defer(
			async () => await writeFile(this.path, FileDB.serialize(this.dictionary), 'utf16le'),
			saveDelay
		)
	}

	async reload() {
		// In case of too much time, write a "modified" call
		const fStat = await stat(this.path)
		if (fStat.isFile() && fStat.size > 0) {
			const data = await readFile(this.path, 'utf16le')
			this.dictionary = FileDB.deserialize<KeyInfos, TextInfos>(data)
		}
	}

	async save() {
		return this.saving.resolve()
	}

	//#region Forwards

	async list(locales: Locale[], zone: Zone) {
		await this.loaded
		return super.list(locales, zone)
	}
	async workList(locales: Locale[]): Promise<WorkDictionary> {
		await this.loaded
		return super.workList(locales)
	}
	async getZone(key: TextKey, locales?: Locale[]) {
		await this.loaded
		return super.getZone(key, locales)
	}
	async modify(key: TextKey, locale: Locale, value: Translation) {
		await this.loaded
		this.saving.defer()
		return super.modify(key, locale, value)
	}
	async key(key: TextKey, zone: Zone) {
		await this.loaded
		this.saving.defer()
		return super.key(key, zone)
	}
	async get(key: TextKey) {
		await this.loaded
		return super.get(key)
	}
	async reKey(key: TextKey, newKey?: TextKey) {
		await this.loaded
		this.saving.defer()
		return super.reKey(key, newKey)
	}

	//#endregion
	//#region serialization

	static serialize<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
		dictionary: MemDBDictionary<KeyInfos, TextInfos>
	) {
		function optioned(obj: any, preTabs = 0) {
			const stringified = stringify(obj, {
				bracesSameLine: true,
				multiline: 'std',
				space: '\t'
			})
			return preTabs ? stringified.replace(/\n/g, '\n' + '\t'.repeat(preTabs)) : stringified
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
							v!.replace(/\n/g, '\n\t\t') +
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
		if (!data.endsWith('\n')) data += '\n'
		const dictionary: MemDBDictionary<KeyInfos, TextInfos> = {}
		data = data.replace(/\n/g, '\u0000') // Only way to make regexp treat '\n' as a regular character
		const rex = {
			key: /([^\t\{:]+)(\{.*?\})?:([^\u0000]*)\u0000/g,
			locale: /\t([^\t\{:]*)(\{.*?\})?(?::((?:[^\u0000]|\u0000\t\t)*))?\u0000/g
		}
		let keyFetch: RegExpExecArray | null
		let lastIndex = 0
		while ((keyFetch = rex.key.exec(data))) {
			if (keyFetch.index > lastIndex) throw parseError(data, lastIndex, keyFetch.index)
			const key = keyFetch[1],
				zone = keyFetch[3] as Zone
			let keyInfos: any,
				textInfos: Record<Locale, any> = {}
			if (keyFetch[2]) keyInfos = parse(keyFetch[2].replace(/\u0000/g, '\n'))
			const entry: MemDBDictionaryEntry<KeyInfos, TextInfos> = {
				'.zone': zone,
				...(keyInfos && { '.keyInfos': keyInfos })
			}
			let localeFetch: RegExpExecArray | null
			rex.locale.lastIndex = lastIndex = rex.key.lastIndex
			while ((localeFetch = rex.locale.exec(data))) {
				if (localeFetch.index > lastIndex) break
				lastIndex = rex.locale.lastIndex
				if (localeFetch[3])
					entry[localeFetch[1] as Locale] = localeFetch[3].replace(/\u0000\t\t/g, '\n')
				if (localeFetch[2])
					textInfos[localeFetch[1] as Locale] = parse(localeFetch[2].replace(/\u0000/g, '\n'))
			}
			rex.key.lastIndex = lastIndex
			if (Object.keys(textInfos).length) entry['.textInfos'] = textInfos
			dictionary[key] = entry
		}
		if (rex.key.lastIndex > 0 || !rex.key.test(data)) throw parseError(data, rex.key.lastIndex)
		return dictionary
	}

	//#endregion
}
