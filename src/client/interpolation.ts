import { translate, split2 } from './helpers'
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
	// TODO Interpolation should have access to localeFlagsEngine
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
		const { client, key } = this
		if (!client.internals.ordinals) return client.missing('internals.ordinals')
		const num = parseInt(str)
		if (isNaN(num)) return client.error(key, 'NaN', { str })
		return client.internals.ordinals[client.pluralRules({ type: 'ordinal' }).select(num)].replace(
			'$',
			str
		)
	},
	plural(this: TContext, str: string, designation: string, plural?: string) {
		const num = parseInt(str),
			{ client, key } = this
		if (isNaN(num)) return client.error(key, 'NaN', { str })
		const rule = client.pluralRules({ type: 'cardinal' }).select(num)
		const rules: string | Record<string, string> = plural
			? { one: designation, other: plural }
			: designation

		if (typeof rules === 'string') {
			if (!client.internals.plurals) return client.missing('internals.plurals')
			if (!client.internals.plurals[rule])
				return client.error(key, 'Missing rule in plurals', { rule })
			return client.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules ? rules[rule] : client.error(key, 'Rule not found', { rule, designation })
	},
	number(this: TContext, str: string, options?: any) {
		const num = parseFloat(str),
			{ client, key } = this
		if (isNaN(num)) return client.error(key, 'NaN', { str })
		if (typeof options === 'string') {
			if (!(options in formats.number))
				return client.error(key, 'Invalid number options', { options })
			options = formats.number[options]
		}
		if (this.client.currency)
			options = {
				currency: this.client.currency,
				...options
			}
		return client.numberFormat(options).format(num)
	},
	date(this: TContext, str: string, options?: any) {
		const nbr = parseInt(str),
			date = new Date(nbr),
			{ client, key } = this
		if (isNaN(nbr)) return client.error(key, 'Invalid date', { str })
		if (typeof options === 'string') {
			if (!(options in formats.date)) return client.error(key, 'Invalid date options', { options })
			options = formats.date[options]
		}
		if (client.timeZone)
			options = {
				timeZone: client.timeZone,
				...options
			}
		return client.dateTimeFormat(options).format(date)
	},
	relative(this: TContext, str: string, options?: any) {
		const content = /(-?\d+)\s*(\w+)/.exec(str),
			{ client, key } = this
		if (!content) return client.error(key, 'Invalid relative format', { str })
		const nbr = parseInt(content[1]),
			unit = content[2]
		const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
		units.push(...units.map((unit) => unit + 's'))

		if (isNaN(nbr)) return client.error(key, 'Invalid number', { str })
		if (!units.includes(unit)) return client.error(key, 'Invalid unit', { unit })
		if (typeof options === 'string') {
			if (!(options in formats.relative))
				return client.error(key, 'Invalid date options', { options })
			options = formats.date[options]
		}
		return client.relativeTimeFormat(options).format(nbr, <Intl.RelativeTimeFormatUnit>unit)
	},
	region(this: TContext, str: string) {
		return (
			this.client.displayNames({ type: 'region' }).of(str) ||
			this.client.error(this.key, 'Invalid region', { str })
		)
	},
	language(this: TContext, str: string) {
		return (
			this.client.displayNames({ type: 'language' }).of(str) ||
			this.client.error(this.key, 'Invalid language', { str })
		)
	},
	script(this: TContext, str: string) {
		return (
			this.client.displayNames({ type: 'script' }).of(str) ||
			this.client.error(this.key, 'Invalid script', { str })
		)
	},
	currency(this: TContext, str: string) {
		return (
			this.client.displayNames({ type: 'currency' }).of(str) ||
			this.client.error(this.key, 'Invalid currency', { str })
		)
	},
	list(this: TContext, ...args: any[]) {
		function makeArray(arg: Record<string, any> | any[] | string) {
			if (Array.isArray(arg) || typeof arg !== 'object') return arg
			const rv = []
			for (const key in arg) rv[parseInt(key)] = arg[key]
			return rv
		}
		let opts = args.pop()
		if (typeof opts !== 'object' || Array.isArray(opts)) {
			args.push(opts)
			opts = {}
		}
		return this.client.listFormat(opts).format(args.map((arg) => makeArray(arg)).flat())
	},
	duration(this: TContext, duration: DurationDescription, options?: DurationOptions) {
		const { client, key } = this
		if (typeof duration !== 'object') return client.error(key, 'Invalid duration', { duration })
		let { showZeros, minUnit, style, useWeeks, calculate, empty } = options || {}
		if (!style) style = 'long'
		useWeeks = useWeeks && <any>useWeeks !== 'false'
		showZeros = showZeros && <any>showZeros !== 'false'
		calculate = ![false, 'false'].includes(<any>calculate)
		const parts: [number, string][] = []
		// First, clone the duration ascending (nanoseconds->years) and add units above if needed (70 seconds = 1 minute, 10 seconds)
		const cappedDuration: DurationDescription = {}
		let remainder = 0
		for (let unitIndex = timeUnits.length - 1; unitIndex >= 0; unitIndex--) {
			const unit = timeUnits[unitIndex]
			let multiplier = timeUnits[unitIndex - 1]?.[1]
			if (multiplier === 7 && !useWeeks) multiplier = undefined
			// `+'s'` to accept "years", "hours", ...
			const given = duration[unit[0]] || (<any>duration)[unit[0] + 's']
			let value = (given === undefined ? 0 : parseFloat(given)) + remainder
			if (calculate && multiplier && value > multiplier) {
				remainder = Math.floor(value / multiplier)
				value = value % multiplier
			} else remainder = 0
			if (given !== undefined || value) cappedDuration[unit[0]] = value
		}

		// Make all time units descending (year->nanoseconds) keeping a remainder
		let hadValue = false
		remainder = 0
		for (const unit of timeUnits) {
			const value = (cappedDuration[unit[0]] || 0) + remainder,
				displayValue = calculate && unit[1] ? Math.floor(value) : value
			if (cappedDuration[unit[0]] !== undefined) hadValue = true
			if (displayValue) {
				hadValue = true
				parts.push([displayValue, unit[0]])
			} else if (showZeros && hadValue && (unit[0] != 'week' || useWeeks)) parts.push([0, unit[0]])
			if (unit[0] === minUnit) break
			if (calculate && unit[1]) {
				const floor = Math.floor(value)
				remainder = (value - floor) * unit[1]
			}
		}
		if (!minUnit)
			// remove least-significant zeros
			while (parts.length) {
				const last = parts.pop()!
				if (last[0] !== 0) {
					parts.push(last)
					break
				}
			}
		if (!parts.length)
			return empty || client.error(key, 'Empty duration', { duration: cappedDuration })
		const translatedParts = parts.map(([value, unit]) =>
			this.client
				.numberFormat({
					style: 'unit',
					unit,
					unitDisplay: style
				})
				.format(value)
		)
		return this.client
			.listFormat({
				style,
				type: style === 'narrow' ? 'unit' : 'conjunction'
			})
			.format(translatedParts)
	}
}

//#region Duration structures

const timeUnits = [
	['year'] as const,
	['month'] as const,
	['week', 7] as const,
	['day', 24] as const,
	['hour', 60] as const,
	['minute', 60] as const,
	['second', 1000] as const,
	['millisecond', 1000] as const,
	['microsecond', 1000] as const,
	['nanosecond'] as const
] as const

type DurationRecord = (typeof timeUnits)[number][0]
export type DurationDescription = Partial<Record<DurationRecord, number>>
export interface DurationOptions {
	showZeros?: boolean
	minUnit?: DurationRecord
	style?: 'long' | 'short' | 'narrow'
	useWeeks?: boolean
	calculate?: boolean
	empty?: string
}

//#endregion

function objectArgument(
	arg: any,
	unescape: (s: string) => string
): string | Record<string, string> {
	if (typeof arg === 'object') return arg
	// Here we throw as it means the code gave a wrong argument
	if (typeof arg !== 'string') throw new TranslationError(`Invalid argument type: ${typeof arg}`)
	if (!/:[^\/\\]/.test(arg)) return arg
	return Object.fromEntries(
		arg.split(',').map((part) => split2(part, ':').map((part) => unescape(part.trim())))
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
	const { client, key } = context
	text = text.replace(/\\{/g, '\u0001').replace(/\\}/g, '\u0002').replace(/\n/g, '\u0003')
	const placeholders = (text.match(/{(.*?)}/g) || []).map((placeholder) => {
			placeholder = placeholder
				.slice(1, -1)
				.replace(/\u0001/g, '{')
				.replace(/\u0002/g, '}')
			const escapements: Record<string, string> = { '/': '/' },
				unescapements: Record<number, string> = {}
			let escapementCounter = 0
			function escaped(s: string) {
				return s.replace(/\\(.)/g, (_, c) => {
					if (!escapements[c]) {
						unescapements[escapementCounter] = c
						escapements[c] = '\u0004' + escapementCounter++ + '\u0005'
					}
					return escapements[c]
				})
			}
			placeholder = escaped(placeholder)
			args = args.map((arg) => (typeof arg === 'string' ? escaped(arg) : arg))
			function unescape(s: string) {
				return s
					.replace(/\u0003/g, '\n')
					.replace(/\u0004([0-9]+)\u0005/g, (_, i) => unescapements[+i])
			}

			function useArgument(i: string | number, dft?: string) {
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
				return val !== undefined ? val : dft !== undefined ? dft : '' //client.error(key, 'Missing arg', { arg: i, key })
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
						return client.error(key, 'Case needs a string case', { params })
					if (params[0] in proc) processed = proc[params[0]]
					else if ('default' in proc) processed = proc.default
					else return client.error(key, 'Case not found', { case: params[0], cases: proc })
				} else if (proc.includes('.')) processed = translate({ ...context, key: proc }, params)
				else if (!(proc in processors)) return client.error(key, 'Unknown processor', { proc })
				else
					try {
						processed = processors[proc].call(context, ...params)
					} catch (error) {
						return client.error(key, 'Error in processor', { proc, error })
					}
				if (processed === null) throw Error(`Unprocessed case: ${proc}`)
				apps.push((nextArgs = [processed, ...others]))
			}
			const rv = apps[0].find((cas) => !!cas)
			return !rv || typeof rv === 'string'
				? unescape(rv || '')
				: client.error(key, 'Object return value', { rv })
		}),
		parts = text.split(/{.*?}/).map((part) =>
			part
				.replace(/\u0001/g, '{')
				.replace(/\u0002/g, '}')
				.replace(/\u0003/g, '\n')
		)

	return parts.map((part, i) => `${part}${placeholders[i] || ''}`).join('')
}
