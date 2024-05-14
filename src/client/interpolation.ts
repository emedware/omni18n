import { reportMissing, reportError, translate } from './helpers'
import { TContext, TranslationError } from './types'

export const formats: Record<'date' | 'number' | 'relative', Record<string, object>> = {
	date: {
		date: {
			dateStyle: 'short'
		},
		time: {
			timeStyle: 'short'
		}
	},
	number: {
		decimal: { style: 'decimal' },
		percent: { style: 'percent' },
		scientific: { notation: 'scientific' },
		engineering: { notation: 'engineering' },
		compact: { notation: 'compact' }
	},
	relative: {
		short: {
			numeric: 'always',
			style: 'short'
		},
		long: {
			numeric: 'auto',
			style: 'long'
		}
	}
}

export const processors: Record<string, (...args: any[]) => string> = {
	upper(str: string) {
		return str.toUpperCase()
	},
	lower(str: string) {
		return str.toLowerCase()
	},
	title(str: string) {
		return str.replace(/\b\w/g, (letter) => letter.toUpperCase())
	},
	ordinal(this: TContext, str: string) {
		const { client } = this
		if (!client.internals.ordinals) return reportMissing({ ...this, key: 'internals.ordinals' })
		const num = parseInt(str)
		if (isNaN(num)) return reportError(this, 'NaN', { str })
		return client.internals.ordinals[client.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: TContext, str: string, designation: string, plural?: string) {
		const num = parseInt(str),
			{ client } = this
		if (isNaN(num)) return reportError(this, 'NaN', { str })
		const rule = client.cardinalRules.select(num)
		const rules: string | Record<string, string> = plural
			? { one: designation, other: plural }
			: designation

		if (typeof rules === 'string') {
			if (!client.internals.plurals) return reportMissing({ ...this, key: 'internals.plurals' })
			if (!client.internals.plurals[rule])
				return reportError(this, 'Missing rule in plurals', { rule })
			return client.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules ? rules[rule] : reportError(this, 'Rule not found', { rule, designation })
	},
	number(this: TContext, str: string, options?: any) {
		const num = parseFloat(str),
			{ client } = this
		if (isNaN(num)) return reportError(this, 'NaN', { str })
		if (typeof options === 'string') {
			if (!(options in formats.number))
				return reportError(this, 'Invalid number options', { options })
			options = formats.number[options]
		}
		if (this.client.currency)
			options = {
				currency: this.client.currency,
				...options
			}
		return num.toLocaleString(client.locales, options)
	},
	date(this: TContext, str: string, options?: any) {
		const nbr = parseInt(str),
			date = new Date(nbr),
			{ client } = this
		if (isNaN(nbr)) return reportError(this, 'Invalid date', { str })
		if (typeof options === 'string') {
			if (!(options in formats.date)) return reportError(this, 'Invalid date options', { options })
			options = formats.date[options]
		}
		if (client.timeZone)
			options = {
				timeZone: client.timeZone,
				...options
			}
		return date.toLocaleString(client.locales, options)
	},
	relative(this: TContext, str: string, options?: any) {
		const content = /(-?\d+)\s*(\w+)/.exec(str),
			{ client } = this
		if (!content) return reportError(this, 'Invalid relative format', { str })
		const nbr = parseInt(content[1]),
			unit = content[2]
		const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
		units.push(...units.map((unit) => unit + 's'))

		if (isNaN(nbr)) return reportError(this, 'Invalid number', { str })
		if (!units.includes(unit)) return reportError(this, 'Invalid unit', { unit })
		if (typeof options === 'string') {
			if (!(options in formats.relative))
				return reportError(this, 'Invalid date options', { options })
			options = formats.date[options]
		}
		return new Intl.RelativeTimeFormat(client.locales, options).format(
			nbr,
			<Intl.RelativeTimeFormatUnit>unit
		)
	},
	region(this: TContext, str: string) {
		return (
			new Intl.DisplayNames(this.client.locales[0], { type: 'region' }).of(str) ||
			reportError(this, 'Invalid region', { str })
		)
	},
	language(this: TContext, str: string) {
		return (
			new Intl.DisplayNames(this.client.locales[0], { type: 'language' }).of(str) ||
			reportError(this, 'Invalid language', { str })
		)
	},
	script(this: TContext, str: string) {
		return (
			new Intl.DisplayNames(this.client.locales[0], { type: 'script' }).of(str) ||
			reportError(this, 'Invalid script', { str })
		)
	},
	currency(this: TContext, str: string) {
		return (
			new Intl.DisplayNames(this.client.locales[0], { type: 'currency' }).of(str) ||
			reportError(this, 'Invalid currency', { str })
		)
	}
}

function objectArgument(
	arg: any,
	unescape: (s: string) => string
): string | Record<string, string> {
	if (typeof arg === 'object') return arg
	// Here we throw as it means the code gave a wrong argument
	if (typeof arg !== 'string') throw new TranslationError(`Invalid argument type: ${typeof arg}`)
	if (!/:/.test(arg)) return arg
	return Object.fromEntries(
		arg.split(',').map((part) => part.split(':', 2).map((part) => unescape(part.trim())))
	)
}

/*
Escapement characters:
u0001: {
u0002: }
u0003: \n
u0004-u0005: escapement parenthesis
*/

export function interpolate(context: TContext, text: string, args: any[]): string {
	text = text.replace(/\\{/g, '\u0001').replace(/\\}/g, '\u0002').replace(/\n/g, '\u0003')
	const placeholders = (text.match(/{(.*?)}/g) || []).map((placeholder) => {
			placeholder = placeholder
				.slice(1, -1)
				.replace(/\u0001/g, '{')
				.replace(/\u0002/g, '}')
			const escapements: Record<string, string> = { '/': '/' },
				unescapements: Record<number, string> = {}
			let escapementCounter = 0
			placeholder = placeholder.replace(/\\(.)/g, (_, c) => {
				if (!escapements[c]) {
					unescapements[escapementCounter] = c
					escapements[c] = '\u0004' + escapementCounter++ + '\u0005'
				}
				return escapements[c]
			})
			function unescape(s: string) {
				return s
					.replace(/\u0003/g, '\n')
					.replace(/\u0004([0-9]+)\u0005/g, (_, i) => unescapements[+i])
			}

			function useArgument(i: string | number, dft?: string) {
				const { key } = context
				if (typeof i === 'string' && /^\d+$/.test(i)) i = parseInt(i)
				if (i === 0) return key
				const lastArg = nextArgs[nextArgs.length - 1],
					val =
						i === ''
							? lastArg
							: typeof i === 'number'
								? nextArgs[i - 1]
								: typeof lastArg === 'object' && i in lastArg
									? lastArg[i]
									: undefined
				if (val instanceof Date) return '' + val.getTime()
				if (typeof val === 'object')
					return Object.entries(val)
						.map(([key, value]) => `${key}: ${value}`)
						.join(', ')
				if (typeof val === 'number') return '' + val
				return val !== undefined ? val : dft !== undefined ? dft : '' //reportError(context, 'Missing arg', { arg: i, key })
			}
			function processPart(part: string) {
				return objectArgument(
					part
						.trim()
						.replace(/\$(\w+)(?:\[(.*?)\])?/g, (_, num, dft) => useArgument(num, dft))
						.replace(/\$\.([\.\w]*)/g, (_, key) => translate({ ...context, key }, nextArgs))
						.replace(/\$(?:\[(.*?)\])?/g, (_, dft) => useArgument('', dft)),
					unescape
				)
			}
			let nextArgs = args
			const apps = placeholder.split('::').map((app) => app.split('|').map(processPart))
			while (apps.length > 1) {
				const params = apps.pop()!,
					app = apps.pop()!,
					[proc, ...others] = app
				let processed: string | null = null
				if (typeof proc === 'object') {
					if (params.length !== 1 || typeof params[0] !== 'string')
						return reportError(context, 'Case needs a string case', { params })
					if (params[0] in proc) processed = proc[params[0]]
					else if ('default' in proc) processed = proc.default
					else return reportError(context, 'Case not found', { case: params[0], cases: proc })
				} else if (proc.includes('.')) processed = translate({ ...context, key: proc }, params)
				else if (!(proc in processors))
					processed = reportError(context, 'Unknown processor', { proc })
				else
					try {
						processed = processors[proc].call(context, ...params)
					} catch (error) {
						return reportError(context, 'Error in processor', { proc, error })
					}
				if (processed === null) throw Error(`Unprocessed case: ${proc}`)
				apps.push((nextArgs = [processed, ...others]))
			}
			return apps[0].find((cas) => !!cas)
		}),
		parts = text.split(/{.*?}/).map((part) =>
			part
				.replace(/\u0001/g, '{')
				.replace(/\u0002/g, '}')
				.replace(/\u0003/g, '\n')
		)

	return parts.map((part, i) => `${part}${placeholders[i] || ''}`).join('')
}
