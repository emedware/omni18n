import { mkdir, writeFile, watch } from 'fs/promises'
import { dirname, join, basename } from 'path'
import commandLineArgs from 'command-line-args'
import json5 from 'json5'
import { FileDB } from 'src/db'
import { I18nServer } from 'src/server'
const { stringify } = json5

const options = commandLineArgs(
	[
		{
			name: 'pattern',
			alias: 'p',
			type: String,
			defaultValue: '$.js'
		},
		{
			name: 'watch',
			alias: 'w',
			type: Boolean
		},
		{
			name: 'grouped',
			alias: 'g',
			type: String
		},
		{
			name: 'input',
			alias: 'i',
			type: String
		},
		{
			name: 'output',
			alias: 'o',
			type: String
		},
		{
			name: 'locales',
			type: String,
			defaultOption: true,
			multiple: true
		}
	],
	{
		camelCase: true
	}
)

function fatal(message: string) {
	console.error(message)
	process.exit(1)
}

if (!options.input) fatal('Input must be specified')
const fdb = new FileDB(options.input),
	server = new I18nServer(fdb)

async function* exported() {
	for (const locale of options.locales) {
		const condensed = stringify(await server.condense([locale, ...options.locales]))
		yield {
			locale,
			content: `OmnI18n.preload('${locale}', ${condensed})`
		}
	}
}

async function exportLocales() {
	if (options.grouped) {
		let total = ''
		for await (const { content } of exported()) total += content + '\n'
		const output = join(options.output, options.grouped)
		console.log('->', output)
		await writeFile(output, total, 'utf8')
	} else {
		for await (const { locale, content } of exported()) {
			const output = join(options.output, options.pattern.replace('$', locale))
			console.log('->', output)
			await writeFile(output, content, 'utf8')
		}
	}
}

async function main() {
	await fdb.loaded
	if (options.output) mkdir(options.output, { recursive: true })
	else options.output = dirname(options.input)
	await exportLocales()
	if (options.watch) {
		console.log('Waiting for changes...')
		for await (const event of watch(options.input)) {
			await fdb.reload()
			await exportLocales()
			console.log('Waiting for changes...')
		}
	}
}

main()
