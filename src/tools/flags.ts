import { Locale } from '../types'

function toEmoji(name: string) {
	return String.fromCodePoint(...Array.from(name).map((k) => k.charCodeAt(0) + 127365))
}

/**
 * Some language codes do not have a clear country code and should be indicated here
 *
 * https://emojipedia.org/flags
 */
export const flagCodeExceptions: Record<string, string> = { en: '🇬🇧' }

export function localeFlags(locale: Locale) {
	const parts = locale
		.toLowerCase()
		.split('-', 3)
		.slice(0, 2)
		.map((code) => flagCodeExceptions[code] || toEmoji(code))
	return parts[0] === parts[1] ? [parts[0]] : parts
}
