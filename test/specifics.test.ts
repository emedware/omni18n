import { readFile, unlink, writeFile } from 'node:fs/promises'
import {
	FileDB,
	I18nClient,
	InteractiveServer,
	MemDBDictionary,
	TContext,
	Translator,
	bulkDictionary,
	bulkObject,
	reports,
	localeFlags,
	flagCodeExceptions
} from '../src/index'
import { localStack } from './utils'

const misses = jest.fn()
reports.missing = ({ key }: TContext, fallback?: string) => {
	misses(key)
	return fallback ?? '[no]'
}

describe('bulk', () => {
	let T: Translator, client: I18nClient
	const expected = {
		ok: 'fr-v1.42',
		missing: 'en-v2',
		sub: { v3: 'fr-v3' }
	}

	beforeAll(async () => {
		const { Tp, client: lclClient } = localStack({
			'obj.v1': { fr: 'fr-v1.{$parm}' },
			'obj.v2': { en: 'en-v2' },
			'obj.v3': { fr: 'fr-v3' },
			'struct.ok': { fr: 'fr-v1.{$parm}' },
			'struct.missing': { en: 'en-v2' },
			'struct.sub.v3': { fr: 'fr-v3' },
			'struct.sub': { fr: 'toString' }
		})
		T = await Tp
		client = lclClient
	})

	test('from object', async () => {
		misses.mockClear()
		expect(
			bulkObject(
				T,
				{
					ok: 'obj.v1',
					missing: 'obj.v2',
					sub: { v3: 'obj.v3' }
				},
				{ parm: 42 }
			)
		).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('obj.v2')
	})

	test('from dictionary', async () => {
		misses.mockClear()
		const built = bulkDictionary(T.struct, { parm: 42 })
		expect(built).toEqual(expected)
		expect(misses).toHaveBeenCalledWith('struct.missing')
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
	test('flags', async () => {
		expect(localeFlags('en')).toEqual(['🇬🇧'])
		expect(localeFlags('en-GB')).toEqual(['🇬🇧'])
		expect(localeFlags('en-US-gb')).toEqual(['🇬🇧', '🇺🇸'])
		flagCodeExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
		expect(localeFlags('en-GB')).toEqual(['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧'])
		expect(localeFlags('fr')).toEqual(['🇫🇷'])
		expect(localeFlags('fr-FR')).toEqual(['🇫🇷'])
		expect(localeFlags('fr-BE')).toEqual(['🇫🇷', '🇧🇪'])
	})
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
