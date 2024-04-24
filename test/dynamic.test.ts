import { InteractiveServer } from '../src/server'
import Locale from '../src/locale'
import { Zone, directMem } from './db'

describe('Dynamic functionality', () => {
	let server: InteractiveServer,
		T: any,
		locale: Locale,
		modifications: Record<string, string | undefined>[] = []

	beforeAll(async () => {
		server = new InteractiveServer(
			directMem({
				'fld.name': { en: 'Name', [Zone]: '' },
				'cmd.customize': { en: 'Customize', 'en-UK': 'Customise', [Zone]: '' },
				'cmd.save': { en: 'Save', [Zone]: 'adm' }
			}),
			(entries: Record<string, string | undefined>) => {
				if (locale) {
					//ignore the initialization
					modifications.push(entries)
					locale.modified(entries)
				}
			}
		)
		locale = new Locale('en-UK', server.condense.bind(server))
		T = locale.translation
		await locale.loaded
	})

	test('regular feedback', async () => {
		expect(T.fld.name()).toBe('Name')
		expect(modifications).toEqual([])
		await server.modify('fld.name', 'en', 'Surname')
		await server.saved
		expect(modifications).toEqual([{ 'fld.name': 'Surname' }])
		modifications = []
		expect(T.fld.name()).toBe('Surname')
	})

	test('sub-locale', async () => {
		expect(T.cmd.customize()).toBe('Customise')
		expect(modifications).toEqual([])
		await server.modify('cmd.customize', 'en', 'Customize it')
		await server.saved
		// The generic english entry has been modified, but we use the 'en-UK' one, not just 'en'
		expect(modifications).toEqual([])
		expect(T.cmd.customize()).toBe('Customise')
		await server.modify('cmd.customize', 'en-UK', 'Customise it')
		await server.saved
		expect(modifications).toEqual([{ 'cmd.customize': 'Customise it' }])
		modifications = []
		expect(T.cmd.customize()).toBe('Customise it')
	})

	test('zone', async () => {
		expect(T.cmd.save()).toBe('[cmd.save]')
		expect(modifications).toEqual([])
		await server.modify('cmd.save', 'en', 'Save it')
		await server.saved
		expect(modifications).toEqual([])
		expect(T.cmd.save()).toBe('[cmd.save]')
		locale.enter('adm')
		await locale.loaded
		expect(T.cmd.save()).toBe('Save it')
		await server.modify('cmd.save', 'en', 'Save')
		await server.saved
		expect(modifications).toEqual([{ 'cmd.save': 'Save' }])
		modifications = []
		expect(T.cmd.save()).toBe('Save')
	})
})
