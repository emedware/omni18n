import { readFile, stat, writeFile } from 'node:fs/promises'
import Defer from '../defer'
import { WorkDictionary, type Locale, type TextKey, type Translation, type Zone } from '../types'
import MemDB from './memDb'
import serialization from './serialization'
import json5 from 'json5'
const { parse, stringify } = json5

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
		this.saving = new Defer(async () => {
			let data = serialization.serialize(this.dictionary)
			await writeFile(this.path, data, 'utf16le')
		}, saveDelay)
	}

	async reload() {
		// In case of too much time, write a "modified" call
		const fStat = await stat(this.path)
		if (fStat.isFile() && fStat.size > 0)
			this.dictionary = serialization.deserialize<KeyInfos, TextInfos>(
				await readFile(this.path, 'utf16le')
			)
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
	async modify(key: TextKey, locale: Locale, value: Translation, textInfos?: Partial<TextInfos>) {
		await this.loaded
		this.saving.defer()
		return super.modify(key, locale, value, textInfos)
	}
	async key(key: TextKey, zone: Zone, keyInfos?: Partial<KeyInfos>) {
		await this.loaded
		this.saving.defer()
		return super.key(key, zone, keyInfos)
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
}
