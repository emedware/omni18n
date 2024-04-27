import { reports, translate } from './helpers'
import { TContext, TranslationError } from './types'

export const globals: { currency?: string } = {}

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
		if (!client.internals.ordinals) return reports.missing({ ...this, key: 'internals.ordinals' })
		const num = parseInt(str)
		if (isNaN(num)) return reports.error(this, 'NaN', { str })
		return client.internals.ordinals[client.ordinalRules.select(num)].replace('$', str)
	},
	plural(this: TContext, str: string, designation: string, plural?: string) {
		const num = parseInt(str),
			{ client } = this
		if (isNaN(num)) return reports.error(this, 'NaN', { str })
		const rule = client.cardinalRules.select(num)
		const rules: string | Record<string, string> = plural
			? { one: designation, other: plural }
			: designation

		if (typeof rules === 'string') {
			if (!client.internals.plurals) return reports.missing({ ...this, key: 'internals.plurals' })
			if (!client.internals.plurals[rule])
				return reports.error(this, 'Missing rule in plurals', { rule })
			return client.internals.plurals[rule].replace('$', designation)
		}
		return rule in rules
			? rules[rule]
			: reports.error(this, 'Rule not found', { rule, designation })
	},
	number(this: TContext, str: string, options?: any) {
		const num = parseFloat(str),
			{ client } = this
		if (isNaN(num)) return reports.error(this, 'NaN', { str })
		if (typeof options === 'string') {
			if (!(options in formats.number))
				return reports.error(this, 'Invalid number options', { options })
			options = formats.number[options]
		}
		options = {
			currency: globals.currency,
			...options
		}
		return num.toLocaleString(client.locale, options)
	},
	date(this: TContext, str: string, options?: any) {
		const nbr = parseInt(str),
			date = new Date(nbr),
			{ client } = this
		if (isNaN(nbr)) return reports.error(this, 'Invalid date', { str })
		if (typeof options === 'string') {
			if (!(options in formats.date))
				return reports.error(this, 'Invalid date options', { options })
			options = formats.date[options]
		}
		options = {
			timeZone: client.timeZone,
			...options
		}
		return date.toLocaleString(client.locale, options)
	},
	relative(this: TContext, str: string, options?: any) {
		const content = /(-?\d+)\s*(\w+)/.exec(str),
			{ client } = this
		if (!content) return reports.error(this, 'Invalid relative format', { str })
		const nbr = parseInt(content[1]),
			unit = content[2]
		const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
		units.push(...units.map((unit) => unit + 's'))

		if (isNaN(nbr)) return reports.error(this, 'Invalid number', { str })
		if (!units.includes(unit)) return reports.error(this, 'Invalid unit', { unit })
		if (typeof options === 'string') {
			if (!(options in formats.relative))
				return reports.error(this, 'Invalid date options', { options })
			options = formats.date[options]
		}
		return new Intl.RelativeTimeFormat(client.locale, options).format(
			nbr,
			<Intl.RelativeTimeFormatUnit>unit
		)
	},
	region(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'region' }).of(str) ||
			reports.error(this, 'Invalid region', { str })
		)
	},
	language(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'language' }).of(str) ||
			reports.error(this, 'Invalid language', { str })
		)
	},
	script(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'script' }).of(str) ||
			reports.error(this, 'Invalid script', { str })
		)
	},
	currency(this: TContext, str: string) {
		return (
			new Intl.DisplayNames([this.client.locale], { type: 'currency' }).of(str) ||
			reports.error(this, 'Invalid currency', { str })
		)
	}
}

function objectArgument(arg: any): string | Record<string, string> {
	if (typeof arg === 'object') return arg
	// Here we throw as it means the code gave a wrong argument
	if (typeof arg !== 'string') throw new TranslationError(`Invalid argument type: ${typeof arg}`)
	if (!/[^:]:/.test(arg)) return arg.replace(/::/g, ':')
	return Object.fromEntries(
		arg
			.replace(/::/g, '\u0000')
			.split(',')
			.map((part) => part.split(':', 2).map((part) => part.replace(/\u0000/g, ':').trim()))
	)
}

export function interpolate(context: TContext, text: string, args: any[]): string {
	const { key, zones } = context
	function arg(i: string | number, dft?: string) {
		if (typeof i === 'string' && /^\d+$/.test(i)) i = parseInt(i)
		if (i === 0) return key
		const lastArg = args[args.length - 1],
			val =
				i === ''
					? lastArg
					: typeof i === 'number'
						? args[i - 1]
						: typeof lastArg === 'object' && i in lastArg
							? lastArg[i]
							: undefined
		if (val instanceof Date) return '' + val.getTime()
		if (typeof val === 'object')
			return Object.entries(val)
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ')
		if (typeof val === 'number') return '' + val
		return val !== undefined
			? val
			: dft !== undefined
				? dft
				: reports.error(context, 'Missing arg', { arg: i, key })
	}
	text = text.replace(/{{/g, '\u0001').replace(/}}/g, '\u0002')
	const placeholders = (text.match(/{(.*?)}/g) || []).map((placeholder) => {
			placeholder = placeholder
				.slice(1, -1)
				.replace(/\u0001/g, '{')
				.replace(/\u0002/g, '}')
			// Special {=1}, {=1|default} for "First argument" syntax
			const simpleArg = /^=(\w*)(?:\s*\|\s*(.*)\s*)?$/.exec(placeholder)
			if (simpleArg) return arg(simpleArg[1], simpleArg[2])
			else {
				const [proc, ...params] = placeholder
					.split('|')
					.map((part) => part.trim().replace(/\$\$/g, '\u0003'))
					.map((part) =>
						part.replace(/\$(\w*)(?:\[(.*?)\])?/g, (_, num, dft) =>
							arg(num.replace(/\u0003/g, '$'), dft?.replace(/\u0003/g, '$'))
						)
					)
					.map((part) => objectArgument(part))
				if (typeof proc === 'object')
					return params.length !== 1 || typeof params[0] !== 'string'
						? reports.error(context, 'Case needs a string case', { params })
						: params[0] in proc
							? proc[params[0]]
							: 'default' in proc
								? proc.default
								: reports.error(context, 'Case not found', { case: params[0], cases: proc })
				if (proc.includes('.')) return translate({ ...context, key: proc }, params)
				if (!(proc in processors)) return reports.error(context, 'Unknown processor', { proc })
				try {
					return processors[proc].call(context, ...params)
				} catch (error) {
					return reports.error(context, 'Error in processor', { proc, error })
				}
			}
		}),
		parts = text.split(/{.*?}/).map((part) => part.replace(/\u0001/g, '{').replace(/\u0002/g, '}'))

	return parts.map((part, i) => `${part}${placeholders[i] || ''}`).join('')
}
