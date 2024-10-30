import { readFile, unlink, writeFile } from 'node:fs/promises'
import {
	serialization,
	I18nClient,
	InteractiveServer,
	MemDBDictionary,
	Translator,
	bulkDictionary,
	bulkObject,
	localeFlagsEngine,
	flagEmojiExceptions,
	flagClassExceptions,
	parse,
	stringify
} from '~/s-a'
import { FileDB } from '~/server'
import { localStack } from './utils'

const misses = jest.fn()

class TestI18nClient extends I18nClient {
	report(key: string, error: string, spec?: object | undefined): void {
		misses(error, key, spec)
	}
}

describe('bulk', () => {
	let T: Translator, client: I18nClient

	beforeAll(async () => {
		const { Tp, client: lclClient } = localStack(
			{
				'obj.v1': { fr: 'fr-v1.{$parm}' },
				'obj.v2': { en: 'en-v2' },
				'obj.v3': { fr: 'fr-v3' },
				'struct.ok': { fr: 'fr-v1.{$parm}' },
				'struct.missing': { en: 'en-v2' },
				'struct.sub.v3': { fr: 'fr-v3' },
				'struct.sub': { fr: 'toString' }
			},
			TestI18nClient
		)
		T = await Tp
		client = lclClient
	})

	test('from object', async () => {
		misses.mockClear()
		const expected = {
			ok: 'fr-v1.42',
			missingT: 'en-v2',
			missingK: '[obj.v4]',
			sub: { v3: 'fr-v3' }
		}
		expect(
			bulkObject(
				T,
				{
					ok: 'obj.v1',
					missingT: 'obj.v2',
					missingK: 'obj.v4',
					sub: { v3: 'obj.v3' }
				},
				{ parm: 42 }
			)
		).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('Missing translation', 'obj.v2', undefined)
		expect(misses).toHaveBeenCalledWith('Missing key', 'obj.v4', undefined)
	})

	test('from dictionary', async () => {
		const expected = {
			ok: 'fr-v1.42',
			missing: 'en-v2',
			sub: { v3: 'fr-v3' }
		}
		misses.mockClear()
		const built = bulkDictionary(T.struct, { parm: 42 })
		expect(built).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('Missing translation', 'struct.missing', undefined)
		expect('' + built.sub).toBe('toString')
	})
})

describe('specifics', () => {
	test('partial', async () => {
		const { client: SSC } = localStack({
			'test.only': { fr: 'only' },
			'test.zone': { fr: 'zone', '.zone': 'z' }
		})
		await SSC.enter('z')
		expect(JSON.stringify(SSC.getPartialLoad(['']))).toBe('[["z"],{"test":{"zone":"zone"}}]')
		const partial = SSC.getPartialLoad(['z'])
		expect(JSON.stringify(partial)).toBe('[[""],{"test":{"only":"only"}}]')
		const CSC = new I18nClient(['fr'], () => {
			throw 'no condensed'
		})
		CSC.usePartial(partial)
		const T = await CSC.enter()
		expect(T.test.only()).toBe('only')
	})
	test('emojis flags', async () => {
		const localeFlags = localeFlagsEngine('emojis')
		expect(localeFlags('en')).toEqual(['🇬🇧'])
		expect(localeFlags('en-GB')).toEqual(['🇬🇧'])
		expect(localeFlags('en-US-gb')).toEqual(['🇬🇧', '🇺🇸'])
		flagEmojiExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
		expect(localeFlags('en-GB')).toEqual(['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧'])
		expect(localeFlags('fr')).toEqual(['🇫🇷'])
		expect(localeFlags('fr-FR')).toEqual(['🇫🇷'])
		expect(localeFlags('fr-BE')).toEqual(['🇫🇷', '🇧🇪'])
	})
	test('flag-icons flags', async () => {
		const localeFlags = localeFlagsEngine('flag-icons')
		expect(localeFlags('en')).toEqual(['<span class="fi fi-gb"></span>'])
		expect(localeFlags('en-GB')).toEqual(['<span class="fi fi-gb"></span>'])
		expect(localeFlags('en-US-gb')).toEqual([
			'<span class="fi fi-gb"></span>',
			'<span class="fi fi-us"></span>'
		])
		flagClassExceptions.en = 'gb-eng'
		expect(localeFlags('en-GB')).toEqual([
			'<span class="fi fi-gb-eng"></span>',
			'<span class="fi fi-gb"></span>'
		])
		expect(localeFlags('fr')).toEqual(['<span class="fi fi-fr"></span>'])
		expect(localeFlags('fr-FR')).toEqual(['<span class="fi fi-fr"></span>'])
		expect(localeFlags('fr-BE')).toEqual([
			'<span class="fi fi-fr"></span>',
			'<span class="fi fi-be"></span>'
		])
	})
	test('fallbacks', async () => {
		misses.mockClear()
		const { Tp } = localStack(
			{
				'fld.name': { en: 'Name' },
				'fld.bday': { en: 'Birthday', fr: 'Anniversaire' },
				'fld.bday.short': { en: 'Bday' }
			},
			TestI18nClient
		)
		const T = await Tp
		misses.mockClear()
		expect('' + T.fld.name).toBe('Name')
		expect(misses).toHaveBeenCalledWith('Missing translation', 'fld.name', undefined)
		misses.mockClear()
		expect('' + T.fld.bday.short).toBe('Anniversaire')
		expect(misses).not.toHaveBeenCalled()
		expect('' + T.fld.inexistent).toBe('[fld.inexistent]')
		expect(misses).toHaveBeenCalledWith('Missing key', 'fld.inexistent', undefined)
	})
})

describe('fileDB', () => {
	test('serialize', () => {
		const content: MemDBDictionary<any, any> = {
			'serializations.nl1': {
				'': 'Line 1\nLine2',
				'.zone': ''
			},
			'fld.name': { en: 'Name', fr: 'Nom', '.zone': 'sls' },
			'serializations.nl2': {
				'': 'Line 1\nLine2',
				'.zone': 'nls'
			}
		}
		Object.assign(content['fld.name'], {
			'.keyInfos': { a: 1 },
			'.textInfos': { en: { a: '"\'`' }, hu: { a: 3 } }
		})
		const serialized = serialization.serialize<any, any>(content)
		expect(serialization.deserialize(serialized)).toEqual(content)
	})
	test('file DB', async () => {
		await writeFile(
			'./db.test',
			`fld.name{note: "the name of the person"}:
	en:Name
	fr{obvious: true}:Nom
test.multiline:
	:Line 1
		Line 2
`,
			'utf16le'
		)
		const db = new FileDB<any, any>('./db.test')
		await db.loaded
		expect(db.dictionary['fld.name']?.en).toBe('Name')
		expect(db.dictionary['fld.name']['.keyInfos']?.note).toBe('the name of the person')
		expect(db.dictionary['fld.name']['.textInfos']?.fr.obvious).toBe(true)
		expect(db.dictionary['test.multiline']?.['']).toBe('Line 1\nLine 2')
		const server = new InteractiveServer(db)
		await server.modify('fld.name', 'hu', 'Név')
		await db.save()
		const content = await readFile('./db.test', 'utf16le')
		expect(content).toBe(`fld.name{note: 'the name of the person'}:
	en:Name
	fr{obvious: true}:Nom
	hu:Név
test.multiline:
	:Line 1
		Line 2
`)
		await unlink('./db.test')
	})
})

describe('gpt-js', () => {
	describe('stringify function', () => {
		test('should stringify a simple object', () => {
			const obj = { name: 'John', age: 30 }
			const expected = "{name: 'John', age: 30}"
			expect(stringify(obj)).toBe(expected)
		})

		test('should stringify an object with indentation', () => {
			const obj = { name: 'John', 'age-': 30 }
			const expected = `{
\tname: 'John',
\t'age-': 30
}`
			expect(stringify(obj, 10, '\t')).toBe(expected)
		})

		test('should stringify strings', () => {
			expect(stringify("a'b", 10, '\t')).toBe(`"a'b"`)
			expect(stringify('a"b', 10, '\t')).toBe(`'a"b'`)
		})

		test('complex stringify', () => {
			const obj = {
				name: 'John',
				age: 30,
				isAdmin: true,
				hobbies: ['reading', 'coding', 'swimming'],
				address: {
					city: 'New\nYork',
					country: 'USA'
				}
			}
			const expected = `{
	name: 'John',
	age: 30,
	isAdmin: true,
	hobbies: ['reading', 'coding', 'swimming'],
	address: {city: 'New
York', country: 'USA'}
}`
			expect(stringify(obj, 40, '\t')).toBe(expected)
		})
	})
	describe('parse function', () => {
		test('should parse a simple JSON string', () => {
			const jsonString = '{"name":"John","age":30}'
			const expected = { name: 'John', age: 30 }
			expect(parse(jsonString)).toEqual(expected)
		})

		test('should throw SyntaxError when parsing invalid JSON', () => {
			const invalidJsonString = '{"name":"John","age":}'
			expect(() => parse(invalidJsonString)).toThrow(SyntaxError)
		})

		test('complex parse', () => {
			const jsonString = `{
     // This is a comment
	name: "John",// Another comment
	age: 30/* multi
line*/,
	isAdmin: true,
	hobbies: ["reading", "coding", "swimming"],
	address: {city: "New
York", country: \`USA\`/* -- */}
}`
			const expected = {
				name: 'John',
				age: 30,
				isAdmin: true,
				hobbies: ['reading', 'coding', 'swimming'],
				address: {
					city: 'New\nYork',
					country: 'USA'
				}
			}
			expect(parse(jsonString)).toEqual(expected)
		})
	})
})
