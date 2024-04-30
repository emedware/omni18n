import {
	FileDB,
	InteractiveServer,
	MemDictionary,
	TContext,
	Translator,
	bulk,
	reports
} from '../src/index'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { localStack } from './utils'

const misses = jest.fn()
reports.missing = ({ key }: TContext, fallback?: string) => {
	misses(key)
	return fallback ?? '[no]'
}

describe('bulk', () => {
	let T: Translator
	const expected = {
		ok: 'fr-v1',
		missing: 'en-v2',
		sub: { v3: 'fr-v3' }
	}

	beforeAll(async () => {
		const { Tp } = localStack({
			'sub.obj.v1': { fr: 'fr-v1' },
			'sub.obj.v2': { en: 'en-v2' },
			'sub.obj.v3': { fr: 'fr-v3' },
			'struct.obj.ok': { fr: 'fr-v1' },
			'struct.obj.missing': { en: 'en-v2' },
			'struct.obj.sub.v3': { fr: 'fr-v3' },
			'struct.obj.sub': { fr: 'toString' }
		})
		T = await Tp
	})

	test('from object', async () => {
		misses.mockClear()
		expect(
			T.sub[bulk]({
				ok: 'obj.v1',
				missing: 'obj.v2',
				sub: { v3: 'obj.v3' }
			})
		).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('sub.obj.v2')
	})

	test('from dictionary', async () => {
		misses.mockClear()
		const built = T.struct[bulk]('obj')
		expect(built).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('struct.obj.missing')
		expect('' + built.sub).toBe('toString')
	})
})

describe('specifics', () => {
	test('errors', async () => {
		// TODO test errors
	})
	test('fallbacks', async () => {
		misses.mockClear()
		const { Tp } = localStack({
			'fld.name': { en: 'Name' },
			'fld.bday': { en: 'Birthday', fr: 'Anniversaire' },
			'fld.bday.short': { en: 'Bday' }
		})
		const T = await Tp
		misses.mockClear()
		expect('' + T.fld.name).toBe('Name')
		expect(misses).toHaveBeenCalledWith('fld.name')
		misses.mockClear()
		expect('' + T.fld.bday.short).toBe('Anniversaire')
		expect(misses).not.toHaveBeenCalled()
		expect('' + T.fld.inexistent).toBe('[no]')
		expect(misses).toHaveBeenCalledWith('fld.inexistent')
	})
	test('serialize', () => {
		const content: MemDictionary<any, any> = {
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
			['.keyInfos']: { a: 1 },
			['.textInfos']: { en: { a: '"\'`' }, hu: { a: 3 } }
		})
		const serialized = FileDB.serialize<any, any>(content)
		expect(FileDB.deserialize(serialized)).toEqual(content)
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
		expect(content).toBe(`fld.name{
	note: the name of the person
}:
	en:Name
	fr{
		obvious: true
	}:Nom
	hu:Név
test.multiline:
	:Line 1
		Line 2
`)
		await unlink('./db.test')
	})
})
