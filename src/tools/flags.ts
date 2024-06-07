import { Locale } from '../types'

/**
 * Some language codes do not have a clear country code and should be indicated here
 *
 * https://emojipedia.org/flags
 */
export const flagEmojiExceptions: Record<string, string> = { en: '🇬🇧' }
export const flagClassExceptions: Record<string, string> = { en: 'gb' }

const styleSheet = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/7.2.3/css/flag-icons.min.css" integrity="sha512-bZBu2H0+FGFz/stDN/L0k8J0G8qVsAL0ht1qg5kTwtAheiXwiRKyCq1frwfbSFSJN3jooR5kauE0YjtPzhZtJQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />`

export let flagEngine: 'emojis' | 'flag-icons'
export let headStyle: string = ''
flagEngine = 'emojis' // Do not initialize on declaration, rollup considers it as a constant

export function setFlagEngine(engine: 'emojis' | 'flag-icons') {
	flagEngine = engine
	headStyle = engine === 'flag-icons' ? styleSheet : ''
	if (engine === 'flag-icons' && typeof window !== undefined) {
		let alreadyHasStyleSheet = false
		//const stylesheets = document.querySelectorAll('link[rel="stylesheet"][href*="/flag-icons."]')
		const stylesheets = document.querySelectorAll('link[rel="stylesheet"]')
		for (let i = 0; i < stylesheets.length; i++) {
			if (stylesheets[i].getAttribute('href')?.includes('/flag-icons.')) {
				alreadyHasStyleSheet = true
				break
			}
		}
		if (!alreadyHasStyleSheet) document.head.insertAdjacentHTML('beforeend', styleSheet)
	}
}

if (typeof navigator !== 'undefined') gotUserAgent(navigator.userAgent)

/**
 * Set the global flag engine based on the user agent
 * @param userAgent The kind of string returned by `navigator.userAgent` or given in the `user-agent` request header
 */
export function gotUserAgent(userAgent: string) {
	if (userAgent.toLowerCase().includes('windows')) setFlagEngine('flag-icons')
}

function localeFlagsEmojis(locale: Locale) {
	const parts = locale
		.toLowerCase()
		.split('-', 3)
		.slice(0, 2)
		.map(
			(code) =>
				flagEmojiExceptions[code] ||
				String.fromCodePoint(...Array.from(code).map((k) => k.charCodeAt(0) + 127365))
		)
	return parts[0] === parts[1] ? [parts[0]] : parts
}

function localeFlagsIcons(locale: Locale) {
	function createSpan(code: string) {
		return `<span class="fi fi-${code}"></span>`
	}
	const parts = locale
		.toLowerCase()
		.split('-', 2)
		.map((code) => createSpan(flagClassExceptions[code] || code))
	return parts[0] === parts[1] ? [parts[0]] : parts
}

/**
 * Gets one or two html strings representing the flags for the given locale (2 in case of `en-US` for example)
 * @param locale The locale
 * @param engine Optional: specify wether the targeted system is windows or not (if not, just use emojis)
 * @returns
 */
export function localeFlags(locale: Locale, engine?: 'emojis' | 'flag-icons'): string[] {
	return (engine ?? flagEngine) === 'emojis' ? localeFlagsEmojis(locale) : localeFlagsIcons(locale)
}
