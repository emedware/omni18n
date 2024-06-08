/**
 * "Library" for stringifying and parsing human-readable JSON
 * Made in 1/2h with chatGPT
 */
type JSONValue = string | number | boolean | null | JSONObject | JSONArray
interface JSONObject {
	[key: string]: JSONValue
}
interface JSONArray extends Array<JSONValue> {}

/**
 * Stringify a human-js value
 * @param {JSONValue} value
 * @param {number} maxLength Length of an object/array after which it is broken in several lines
 * @param {number | '\t'} indentation Number of spaces per indentation level / tab
 */
export function stringify(
	value: JSONValue,
	maxLength: number = 80,
	indentation: number | '\t' = '\t'
): string {
	function innerStringify(value: JSONValue, currentIndent: number, currentLength: number): string {
		if (typeof value === 'object' && value !== null) {
			if (Array.isArray(value)) {
				return stringifyArray(value, currentIndent, currentLength)
			} else {
				return stringifyObject(value, currentIndent, currentLength)
			}
		} else if (typeof value === 'string') {
			return stringifyString(value)
		} else {
			return String(value)
		}
	}
	function stringifyString(value: string): string {
		let quote = ''
		for (quote of "'\"`'") if (!value.includes(quote)) break
		return quote + value.replace(new RegExp(quote, 'g'), '\\' + quote) + quote
	}
	function stringifyKey(key: string): string {
		return /^[a-zA-Z_]\w*$/.test(key) ? key : stringifyString(key)
	}

	function stringifyObject(obj: JSONObject, currentIndent: number, currentLength: number): string {
		const entries = Object.entries(obj)
		if (entries.length === 0) {
			return '{}'
		}
		let result = '{'
		for (const [key, val] of entries) {
			const strValue = innerStringify(
				val,
				currentIndent + getIndentSize(indentation),
				currentLength + key.length + 4
			)
			const newLength = currentLength + key.length + 4 + strValue.length
			if (newLength <= maxLength) {
				result += stringifyKey(key) + ': ' + strValue + ', '
			} else {
				return stringifyObjectMultiline(obj, currentIndent)
			}
		}
		return result.slice(0, -2) + '}'
	}

	function stringifyObjectMultiline(obj: JSONObject, currentIndent: number): string {
		const entries = Object.entries(obj)
		if (entries.length === 0) {
			return '{}'
		}
		const indent = getIndentString(currentIndent)
		let result = '{\n'
		for (const [key, val] of entries) {
			const strValue = innerStringify(val, currentIndent + getIndentSize(indentation), 0)
			result +=
				indent +
				getIndentString(getIndentSize(indentation)) +
				stringifyKey(key) +
				': ' +
				strValue +
				',\n'
		}
		result = result.slice(0, -2) + '\n' + getIndentString(currentIndent) + '}'
		return result
	}

	function stringifyArray(arr: JSONArray, currentIndent: number, currentLength: number): string {
		if (arr.length === 0) {
			return '[]'
		}
		let result = '['
		for (const val of arr) {
			const strValue = innerStringify(
				val,
				currentIndent + getIndentSize(indentation),
				currentLength + 2
			)
			const newLength = currentLength + 2 + strValue.length
			if (newLength <= maxLength) {
				result += strValue + ', '
			} else {
				return stringifyArrayMultiline(arr, currentIndent)
			}
		}
		return result.slice(0, -2) + ']'
	}

	function stringifyArrayMultiline(arr: JSONArray, currentIndent: number): string {
		if (arr.length === 0) {
			return '[]'
		}
		const indent = getIndentString(currentIndent)
		let result = '[\n'
		for (const val of arr) {
			const strValue = innerStringify(val, currentIndent + getIndentSize(indentation), 0)
			result += indent + getIndentString(getIndentSize(indentation)) + strValue + ',\n'
		}
		result = result.slice(0, -2) + '\n' + getIndentString(currentIndent) + ']'
		return result
	}

	function getIndentString(indentSize: number): string {
		return indentation === '\t'
			? '\t'.repeat(Math.max(indentSize / 4, 0))
			: getIndentString(Math.max(indentSize, 0))
	}

	function getIndentSize(indentation: number | string): number {
		return typeof indentation === 'number' ? Math.max(indentation, 0) : 4
	}

	return innerStringify(value, 0, 0)
}

export function parse(jsonString: string): JSONValue {
	function syntaxError(dtl: string) {
		return new SyntaxError(
			`${dtl}\nat line ${lineNumber} column ${columnNumber}: ` + jsonString.slice(index, index + 20)
		)
	}
	let index = 0
	let lineNumber = 1
	let columnNumber = 1

	function skipWhitespace() {
		while (index < jsonString.length && /\s/.test(jsonString[index])) {
			if (jsonString[index] === '\n') {
				lineNumber++
				columnNumber = 1
			} else {
				columnNumber++
			}
			index++
		}
	}

	function skipComment() {
		if (jsonString[index] === '/' && jsonString[index + 1] === '/') {
			// Single-line comment, skip until the end of the line
			while (index < jsonString.length && jsonString[index] !== '\n') {
				index++
			}
			lineNumber++
			columnNumber = 1
		} else if (jsonString[index] === '/' && jsonString[index + 1] === '*') {
			// Multi-line comment, skip until '*/' is encountered
			index += 2 // Skip the opening '/*'
			while (
				index < jsonString.length &&
				!(jsonString[index] === '*' && jsonString[index + 1] === '/')
			) {
				if (jsonString[index] === '\n') {
					lineNumber++
					columnNumber = 1
				} else {
					columnNumber++
				}
				index++
			}
			if (index >= jsonString.length) {
				throw syntaxError(`Unexpected end of input while parsing multiline comment`)
			}
			index += 2 // Skip the closing '*/'
			columnNumber += 2
		}
	}

	function parseString(): string {
		const quote = jsonString[index]
		if (!'\'"`'.includes(quote)) throw syntaxError(`Unexpected character`)
		let value = ''
		index++ // Skip opening quote
		columnNumber++
		while (index < jsonString.length && jsonString[index] !== quote) {
			if (jsonString[index] === '\\' && jsonString[index + 1] === quote) {
				// Handle escaped quotes
				value += quote
				index += 2
			} else if (jsonString[index] === '\n') {
				// Multiline string
				value += jsonString[index++]
				lineNumber++
				columnNumber = 1
			} else {
				value += jsonString[index++]
				columnNumber++
			}
		}
		if (index >= jsonString.length)
			throw syntaxError(`Unexpected end of input while parsing string`)
		index++ // Skip closing quote
		columnNumber++
		return value
	}

	function parseKey(): string {
		skipWhitespace()
		const quote = jsonString[index]
		if ('\'"`'.includes(quote)) {
			// If the key starts with a quote, parse it as a string
			return parseString()
		} else {
			// If the key does not start with a quote, parse it as an unquoted key
			let key = ''
			// Check if the key starts with a valid character
			if (/[a-zA-Z_$]/.test(jsonString[index])) {
				key += jsonString[index++]
				columnNumber++
			} else {
				throw syntaxError(`Unexpected character`)
			}
			// Continue adding valid characters to the key
			while (index < jsonString.length && /[a-zA-Z0-9_$]/.test(jsonString[index])) {
				key += jsonString[index++]
				columnNumber++
			}
			return key
		}
	}

	function parseValue(): JSONValue {
		skipWhitespace()
		if (jsonString[index] === '{') {
			return parseObject()
		} else if (jsonString[index] === '[') {
			return parseArray()
		} else if ('"\'`'.includes(jsonString[index])) {
			return parseString()
		} else {
			return parseLiteral()
		}
	}

	function parseLiteral(): JSONValue {
		let literal = ''
		while (index < jsonString.length && /\w/.test(jsonString[index])) {
			literal += jsonString[index++]
			columnNumber++
		}
		if (literal === 'true') {
			return true
		} else if (literal === 'false') {
			return false
		} else if (literal === 'null') {
			return null
		} else if (!isNaN(parseFloat(literal))) {
			return parseFloat(literal)
		}
		throw syntaxError(`Unexpected character`)
	}

	function parseArray(): JSONArray {
		let arr: JSONArray = []
		index++ // Skip opening bracket
		columnNumber++
		while (jsonString[index] !== ']') {
			arr.push(parseValue())
			skipWhitespace()
			if (jsonString[index] === ',') {
				index++ // Skip comma
				columnNumber++
			} else if (jsonString[index] !== ']') {
				throw syntaxError(`Unexpected character`)
			}
			skipWhitespace()
		}
		if (index >= jsonString.length) {
			throw syntaxError(`Unexpected end of input while parsing array`)
		}
		index++ // Skip closing bracket
		columnNumber++
		return arr
	}

	function parseObject(): JSONObject {
		let obj: JSONObject = {}
		index++ // Skip opening brace
		columnNumber++
		skipAllIgnored()
		while (jsonString[index] !== '}') {
			const key = parseKey()
			skipAllIgnored()
			if (jsonString[index++] !== ':') {
				throw syntaxError(`Expected ':'`)
			}
			skipAllIgnored()
			const value = parseValue()
			obj[key] = value
			skipAllIgnored()
			if (jsonString[index] === ',') {
				index++ // Skip comma
				columnNumber++
				skipAllIgnored()
			} else if (jsonString[index] !== '}') {
				throw syntaxError(`Unexpected character`)
			}
		}
		if (index >= jsonString.length) {
			throw syntaxError(`Unexpected end of input while parsing object`)
		}
		index++ // Skip closing brace
		columnNumber++
		return obj
	}

	function skipAllIgnored(): void {
		while (index < jsonString.length) {
			skipWhitespace()
			if (
				jsonString[index] === '/' &&
				(jsonString[index + 1] === '/' || jsonString[index + 1] === '*')
			) {
				skipComment()
			} else {
				break
			}
		}
	}

	return parseValue()
}
