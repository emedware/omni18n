import {
	FileDB,
	I18nClient,
	I18nServer,
	InteractiveServer,
	MemDB,
	MemDictionary,
	TContext,
	reports
} from '../src/index'
import { WaitingDB } from './db'
import { readFile, writeFile, unlink, cp } from 'node:fs/promises'

describe('specifics', () => {
	test('errors', async () => {
		// TODO test errors
	})
	test('fallbacks', async () => {
		const misses = jest.fn()
		reports.missing = ({ key }: TContext, fallback?: string) => {
			misses(key)
			return fallback ?? '[no]'
		}

		const server = new I18nServer(
				new WaitingDB(
					new MemDB({
						'fld.name': { en: 'Name', '.zone': '' },
						'fld.bday': { en: 'Birthday', fr: 'Anniversaire', '.zone': '' },
						'fld.bday.short': { en: 'Bday', '.zone': '' }
					})
				)
			),
			client = new I18nClient(['fr', 'en'], server.condense),
			T = client.enter()
		expect('' + T.fld.name).toBe('...')
		expect('' + T.fld.inexistent).toBe('...')
		await client.loaded
		expect(misses).toHaveBeenCalledWith('fld.inexistent')
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
