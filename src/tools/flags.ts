import { Locale } from '../types'

/**
 * Some language codes do not have a clear country code and should be indicated here
 *
 * https://emojipedia.org/flags
 */
export const flagEmojiExceptions: Record<string, string> = { en: '🇬🇧' }
export const flagClassExceptions: Record<string, string> = { en: 'gb' }

const styleSheet = `\n<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/7.2.3/css/flag-icons.min.css" integrity="sha512-bZBu2H0+FGFz/stDN/L0k8J0G8qVsAL0ht1qg5kTwtAheiXwiRKyCq1frwfbSFSJN3jooR5kauE0YjtPzhZtJQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />`

export let flagEngine: 'emojis' | 'flag-icons'
export let headStyle: string = ''

export interface LocaleFlagsEngine {
	(locale: Locale): string[]
	headerContent?: string
}

const engines: Record<'emojis' | 'flag-icons', LocaleFlagsEngine> = {
	emojis(locale: Locale) {
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
	},
	'flag-icons'(locale: Locale) {
		function createSpan(code: string) {
			return `<span class="fi fi-${code}"></span>`
		}
		const parts = locale
			.toLowerCase()
			.split('-', 2)
			.map((code) => createSpan(flagClassExceptions[code] || code))
		return parts[0] === parts[1] ? [parts[0]] : parts
	}
}
engines['flag-icons'].headerContent = styleSheet
engines.emojis.headerContent = ''

export function localeFlagsEngine(
	agent?: string | 'emojis' | 'flag-icons' | null
): LocaleFlagsEngine {
	let engineName: 'emojis' | 'flag-icons'
	if (agent && ['emojis', 'flag-icons'].includes(agent))
		engineName = agent as 'emojis' | 'flag-icons'
	else {
		if (!agent && typeof navigator !== 'undefined') agent = navigator.userAgent
		engineName = agent
			? agent.toLowerCase().includes('windows')
				? 'flag-icons'
				: 'emojis'
			: 'emojis' // Server-side default decision
	}
	if (engineName === 'flag-icons' && typeof document !== 'undefined') {
		const flagIconsStylesheets = document.querySelectorAll(
			'link[rel="stylesheet"][href*="/flag-icons."]'
		)
		if (!flagIconsStylesheets.length) document.head.insertAdjacentHTML('beforeend', styleSheet)
	}
	return engines[engineName]
}
