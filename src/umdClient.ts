import {
	I18nClient,
	CondensedDictionary,
	Locale,
	Translator,
	TextKey,
	Translation,
	localeFlags,
	reports,
	TContext
} from './client'

declare global {
	var T: Translator
}

type CDic = CondensedDictionary
type CDicE = CDic & Translation

reports.error = (context: TContext, error: string, spec: object) => {
	const { client, key } = context
	console.log('Translation error', client.locales[0], key, error)
	console.dir(error)
	return `[!${error}!]`
}

export type RawType = 'omni18n' | 'json-list' | 'json-tree'
export var i18nClient: I18nClient, locale: Locale
var usedLocales: Locale[] = []

function translatePage() {
	if (<any>globalThis.T)
		for (const element of document.querySelectorAll('[i18n]')) {
			const parts = element.getAttribute('i18n')!.split(',')
			for (const part of parts) {
				const [attr, key] = part.split(':', 2).map((k) => k.trim())
				if (key) element.setAttribute(attr, T[key]())
				else element.innerHTML = T[attr]()
			}
		}
	const localesListElm = document.getElementById('locales-list')
	if (localesListElm) {
		const selectionList: string[] = [],
			usedLocale = locale

		for (const locale of usedLocales) {
			const flags = localeFlags(locale),
				flagsStr =
					flags.length === 1
						? flags[0]
						: `
		<span class="flag-main">${flags[0]}</span>
		<span class="flag-loc">${flags[1]}</span>
`,
				localeName = new Intl.DisplayNames(locale, { type: 'language' }).of(locale),
				selected = usedLocale === locale ? 'selected' : ''
			selectionList.push(`
<button class="locale ${selected}" onclick="OmnI18n.setLocale('${locale}')">
	<span class="flag">${flagsStr}</span>
	<span class="name">${localeName}</span>
</button>
`)
		}

		localesListElm.innerHTML = selectionList.join('')
	}
}

//#region input data processing

function makeTree(raw: Record<string, string>): CondensedDictionary {
	const result: CondensedDictionary = {}
	for (const key in raw) {
		const value = raw[key],
			keys = key.split('.'),
			lastKey = keys.pop() as TextKey
		let current = result
		for (const k of keys) {
			if (!(k in current)) current[k] = <CDicE>{}
			else if (typeof current[k] === 'string') current[k] = <CDicE>{ '': <Translation>current[k] }
			current = current[k] as CDic
		}
		if (current[lastKey]) (<CDic>current[lastKey])[''] = value
		else current[lastKey] = value
	}
	return result
}

function readI18n(raw: string): CondensedDictionary {
	const result: Record<string, string> = {},
		lines = raw.split('\n'),
		keys: string[] = []
	for (let ln = 0; ln < lines.length; ln++) {
		let line = lines[ln]
		const indent = (/^\t*/.exec(line)?.[0] || '').length
		line = line.trimStart()
		if (line.startsWith('#') || !line) continue
		let [key, value] = line.split(':', 2).map((v) => v.trim())
		keys.splice(indent)
		if (value) {
			let html = false
			if (value.startsWith('<<<')) {
				value = value.slice(3)
				if (value[0] === '!') {
					value = value.slice(1)
					html = true
				}
				value = value.trimStart()
				while (!value.endsWith('>>>')) value += '\n' + lines[++ln]
				value = value.slice(0, -3).trimEnd()
			}
			result[[...keys, key].join('.')] = html
				? value
				: value
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/'/g, '&#39;')
						.replace(/"/g, '&#34;')
						.replace(/\n/g, '<br>')
		}
		keys.push(key)
	}
	return makeTree(result)
}

//#endregion

async function loadLanguage() {
	globalThis.T = await i18nClient.enter()
	translatePage()
	for (const cb of localeChangeCBs) cb(locale)
}

/**
 * Initializes UMD usage of the library.
 * @param acceptedLocales A list of accepted locales. The first one is used by default if no match is found
 * @param fileNameTemplate Template of the source dictionary file name. `$` will be replaced by the locale
 */
export async function init(acceptedLocales: Locale[], fileNameTemplate: string, rawType: RawType) {
	usedLocales = acceptedLocales
	const cookie = localStorage.getItem('language'),
		locales = [
			cookie ||
				navigator.languages?.find((l) => l && acceptedLocales.includes(l)) ||
				acceptedLocales[0]
		]
	// exported value
	locale = locales[0]
	i18nClient = new I18nClient(locales, async () => {
		const src = await fetch(fileNameTemplate.replace('$', locale))
		return [
			rawType === 'json-list'
				? makeTree(await src.json())
				: rawType === 'json-tree'
					? ((await src.json()) as CondensedDictionary)
					: readI18n(await src.text())
		]
	})

	document.addEventListener('DOMContentLoaded', translatePage)

	await loadLanguage()
}

const localeChangeCBs: ((locale: Locale) => void)[] = []
export function onLocaleChange(cb: (locale: Locale) => void) {
	localeChangeCBs.push(cb)
	return () => localeChangeCBs.splice(localeChangeCBs.indexOf(cb), 1)
}

export async function setLocale(newLocale: Locale) {
	if (newLocale === locale) return
	i18nClient.setLocales([(locale = newLocale)])
	localStorage.setItem('language', locale)
	await loadLanguage()
}
