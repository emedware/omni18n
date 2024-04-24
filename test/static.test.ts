import Server from '../src/server';
import Locale from '../src/locale';
import { sqlite } from './sqlite';

describe('Static functionality', () => {
	// This is for test purpose: in general usage, only one locale/T is used
	let server: Server, T: Record<string, any>, locales: Record<string, Locale>

	beforeAll(async () => {
		server = new Server(await sqlite())
		// Create both 
		await Promise.all([
			server.create('fld.name', '', {en: 'Name', fr: 'Nom'}),
			server.create('fld.bdate', '', {en: 'Birthday', fr: 'Date de naissance'}),
			server.create('msg.greet', '', {en: 'Hello {0|here}', fr: 'Salut {0|tout le monde}', 'fr-BE': "Salut {0|m'fi}"}),
			server.create('cmd.ban', 'adm', {en: 'Ban user', fr: "Bannir l'utilisateur"})
		])
		const condense = server.condense.bind(server)
		locales = {en: new Locale('en', condense)}
		await Promise.all(Object.values(locales).map((locale) => locale.loaded));
		T = Object.fromEntries(Object.entries(locales).map(([key, value]) => [key, value.translation]))
	})

	test('several kind of text access', () => {
		expect(''+T.en.fld.name).toBe('Name')
		expect(''+T.en.fld.name()).toBe('Name')
		expect(''+T.en.fld['name']).toBe('Name')
		expect(''+T.en['fld.name']).toBe('Name')
	})
});