import { WaitingDB } from './db'
import { Translator, I18nClient, InteractiveServer, MemDB } from '../src/index'

describe('Dynamic functionality', () => {
	let server: InteractiveServer,
		T: Translator,
		client: I18nClient,
		modifications: Record<string, [string, string] | undefined>[] = []

	beforeAll(async () => {
		server = new InteractiveServer(
			new WaitingDB(
				new MemDB({
					'fld.name': { en: 'Name' },
					'cmd.customize': { en: 'Customize', 'en-UK': 'Customise' },
					'cmd.save': { en: 'Save', '.zone': 'adm' },
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
	})

	test('regular feedback', async () => {
		// `T.fld.name()` raises a typescript exception as `T.fld` could be a function, whose `name` is a string
		expect('' + T.fld.name).toBe('Name')
		expect(modifications).toEqual([])
		await server.modify('fld.name', 'en', 'Surname')
		await server.propagate()
		expect(modifications).toEqual([{ 'fld.name': ['Surname', ''] }])
		modifications = []
		expect('' + T.fld.name).toBe('Surname')
	})

	test('sub-locale', async () => {
		expect(T.cmd.customize()).toBe('Customise')
		expect(modifications).toEqual([])
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
		expect(modifications).toEqual([])
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
		expect(modifications).toEqual([])
		await server.key('cmd.delete', '', { en: 'Delete', 'en-UK': 'Remove' })
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.delete': ['Remove', ''] }])
		modifications = []
		expect(T.cmd.delete()).toBe('Remove')
		await server.reKey('cmd.delete')
		await server.propagate()
		expect(modifications).toEqual([{ 'cmd.delete': undefined }])
		modifications = []
		expect(T.cmd.delete()).toBe('[cmd.delete]')
	})

	test('zone modification', async () => {
		expect(modifications).toEqual([])
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
