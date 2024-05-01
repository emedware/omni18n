import {
	I18nClient,
	InteractiveServer,
	MemDB,
	MemDBDictionaryEntry,
	Translator
} from '../src/index'
import { WaitingDB } from './db'

describe('Dynamic functionality', () => {
	let server: InteractiveServer,
		T: Translator,
		client: I18nClient,
		modifications: Record<string, [string, string] | undefined>[] = []

	beforeEach(async () => {
		server = new InteractiveServer(
			new WaitingDB(
				new MemDB<{}, { note: string }>({
					'fld.name': { en: 'Name', fr: 'Nom' },
					'cmd.customize': { en: 'Customize', 'en-UK': 'Customise' },
					'cmd.save': <MemDBDictionaryEntry<{}, { note: string }>>(<unknown>{
						en: 'Save',
						'.zone': 'adm',
						'.textInfos': { 'en-UK': { note: 'Same' } }
					}),
					'cmd.modify': { en: 'Modify', '.zone': 'adm' }
				})
			),
			async (entries: Record<string, [string, string] | undefined>) => {
				if (client) {
					//ignore the initialization
					modifications.push(entries)
					client.modified(entries)
				}
			}
		)
		client = new I18nClient(['en-UK'], server.condense)
		T = await client.enter()
		modifications = []
	})
	afterEach(() => {
		server.destroy()
	})

	test('workList', async () => {
		expect(await server.workList(['en'])).toEqual({
			'fld.name': { zone: '', texts: { en: { text: 'Name' } } },
			'cmd.customize': {
				zone: '',
				texts: { en: { text: 'Customize' }, 'en-UK': { text: 'Customise' } }
			},
			'cmd.save': {
				zone: 'adm',
				texts: {
					en: { text: 'Save' },
					'en-UK': {
						infos: {
							note: 'Same'
						}
					}
				}
			},
			'cmd.modify': { zone: 'adm', texts: { en: { text: 'Modify' } } }
		})
	})

	test('regular feedback', async () => {
		// `T.fld.name()` raises a typescript exception as `T.fld` could be a function, whose `name` is a string
		expect('' + T.fld.name).toBe('Name')
		await server.modify('fld.name', 'en', 'Surname')
		await server.propagate()
		expect(modifications).toEqual([{ 'fld.name': ['Surname', ''] }])
		modifications = []
		expect('' + T.fld.name).toBe('Surname')
	})

	test('sub-locale', async () => {
		expect(T.cmd.customize()).toBe('Customise')
		await server.modify('cmd.customize', 'en', 'Customize it')
		await server.propagate()
		// The generic english entry has been modified, but we use the 'en-UK' one, not just 'en'
		expect(modifications).toEqual([])
		expect(T.cmd.customize()).toBe('Customise')
		await server.modify('cmd.customize', 'en-UK', 'Customise it')
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.customize': ['Customise it', ''] }])
		modifications = []
		expect(T.cmd.customize()).toBe('Customise it')
	})

	test('zone', async () => {
		expect(T.cmd.save()).toBe('[cmd.save]')
		await server.modify('cmd.save', 'en', 'Save it')
		await server.propagate()
		expect(modifications).toEqual([])
		expect(T.cmd.save()).toBe('[cmd.save]')
		await client.enter('adm')
		expect(T.cmd.save()).toBe('Save it')
		await server.modify('cmd.save', 'en', 'Save')
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.save': ['Save', 'adm'] }])
		modifications = []
		expect(T.cmd.save()).toBe('Save')
	})

	test('add/remove', async () => {
		expect(T.cmd.delete()).toBe('[cmd.delete]')
		await server.key('cmd.delete', '', { en: 'Delete', 'en-UK': 'Remove' })
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.delete': ['Remove', ''] }])
		modifications = []
		expect(T.cmd.delete()).toBe('Remove')

		await server.reKey('cmd.delete', 'cmd.remove')
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.delete': undefined, 'cmd.remove': ['Remove', ''] }])
		modifications = []
		expect(T.cmd.delete()).toBe('[cmd.delete]')
		expect(T.cmd.remove()).toBe('Remove')

		await server.reKey('cmd.remove')
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.remove': undefined }])
		modifications = []
		expect(T.cmd.remove()).toBe('[cmd.remove]')
	})

	test('zone modification', async () => {
		await server.key('cmd.modify', '', { fr: 'Modifie' })
		await server.propagate()
		// The text has not changed but the zone did
		expect(modifications).toEqual([{ 'cmd.modify': ['Modify', ''] }])
		modifications = []
		await server.key('cmd.modify', '', { fr: 'Modifier' })
		await server.propagate()
		expect(modifications).toEqual([])
	})
})
