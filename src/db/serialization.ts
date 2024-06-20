import { parse, stringify } from '../tools/gpt-js'
import { Locale, TextKey, Translation, Zone } from 'src/types'
import { MemDBDictionary, MemDBDictionaryEntry } from './memDb'

function parseError(str: string, position: number, end: number = position + 100) {
	let count = 0,
		fetch: RegExpExecArray | null

	while ((fetch = /\u0000/g.exec(str)) && fetch.index < position) count++
	return new Error(`Unparsable data at line ${count}: ${str.slice(position, end)}`)
}
const serialization = {
	serialize<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
		dictionary: MemDBDictionary<KeyInfos, TextInfos>
	) {
		function optioned(obj: any, preTabs = 0) {
			const stringified = stringify(obj)
			return preTabs ? stringified.replace(/\n/g, '\n' + '\t'.repeat(preTabs)) : stringified
		}
		let rv = dictionary['.dbInfos'] ? `#${stringify(dictionary['.dbInfos'])}\n` : ''
		for (const [key, value] of Object.entries(dictionary))
			if (key[0] !== '.') {
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
								(<string>v!).replace(/\n/g, '\n\t\t') +
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
	},

	deserialize<KeyInfos extends {} = {}, TextInfos extends {} = {}>(data: string) {
		const dictionary: MemDBDictionary<KeyInfos, TextInfos> = {}
		if (!data.endsWith('\n')) data += '\n'
		if (data.charCodeAt(0) > 255) data = data.slice(1)
		const mda = /^#(.*?)\n/g.exec(data)
		if (mda) {
			dictionary['.dbInfos'] = parse(mda[1])
			data = data.slice(mda[0].length)
		}
		serialization.analyze<KeyInfos, TextInfos>(
			data,
			(key, zone, infos) => {
				dictionary[key] = {
					...(infos && { '.keyInfos': infos }),
					'.zone': zone,
					'.textInfos': {}
				} as MemDBDictionaryEntry<KeyInfos, TextInfos>
			},
			(key, locale, text, infos) => {
				if (infos) dictionary[key]['.textInfos']![locale] = infos
				if (text !== undefined) dictionary[key][locale] = text
			},
			(key) => {
				if (Object.values(dictionary[key]['.textInfos']!).length === 0)
					delete dictionary[key]['.textInfos']
			}
		)
		return dictionary
	},

	/**
	 * Analyze a file content. A key-context can be used in the scope as the callback calls will always be:
	 * `onKey - onText* - endKey` for each key
	 * @param data The textual data to analyze
	 * @param onKey The callback to enter a key
	 * @param onText The callback to specify a translation
	 * @param endKey The callback when a key is finished
	 */
	analyze<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
		data: string,
		onKey: (key: TextKey, zone: Zone, infos?: KeyInfos) => void,
		onText: (key: TextKey, locale: Locale, text: Translation, infos?: TextInfos) => void,
		endKey?: (key: TextKey) => void
	) {
		if (!data.endsWith('\n')) data += '\n'
		data = data.replace(/\n/g, '\u0000') // Only way to make regexp treat '\n' as a regular character
		const rex = {
			key: /([^\t\{:]+)(\{.*?\})?:([^\u0000]*)\u0000/g,
			locale: /\t([^\t\{:]*)(\{.*?\})?(?::((?:[^\u0000]|\u0000\t\t)*))?\u0000/g
		}
		let keyFetch: RegExpExecArray | null
		let lastIndex = 0
		while ((keyFetch = rex.key.exec(data))) {
			if (keyFetch.index > lastIndex) throw parseError(data, lastIndex, keyFetch.index)
			const key = keyFetch[1].trim(),
				zone = keyFetch[3] as Zone
			let keyInfos: any
			if (keyFetch[2]) keyInfos = parse(keyFetch[2].replace(/\u0000/g, '\n'))
			onKey(key, zone, keyInfos)
			let localeFetch: RegExpExecArray | null
			rex.locale.lastIndex = lastIndex = rex.key.lastIndex
			while ((localeFetch = rex.locale.exec(data))) {
				if (localeFetch.index > lastIndex) break
				lastIndex = rex.locale.lastIndex
				onText(
					key,
					localeFetch[1] as Locale,
					localeFetch[3] && localeFetch[3].replace(/\u0000\t\t/g, '\n'),
					localeFetch[2] ? <TextInfos>parse(localeFetch[2].replace(/\u0000/g, '\n')) : undefined
				)
			}
			endKey?.(key)
			rex.key.lastIndex = lastIndex
		}
		if (rex.key.lastIndex > 0 || !rex.key.test(data)) throw parseError(data, rex.key.lastIndex)
	}
}
export default serialization
