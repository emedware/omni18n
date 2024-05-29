import { mkdir, writeFile, watch } from 'fs/promises'
import { dirname, join } from 'path'
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

async function exportLocales() {
	for (const locale of options.locales) {
		const condensed = await server.condense([locale, ...options.locales]),
			output = join(options.output, options.pattern.replace('$', locale))
		console.log('->', output)
		await writeFile(output, `OmnI18n.preload('${locale}', ${stringify(condensed)})`, 'utf8')
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
