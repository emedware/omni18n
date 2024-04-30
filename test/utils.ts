import { I18nClient, I18nServer, MemDB, MemDictionary } from '../src/index'
import { WaitingDB } from './db'

export function localStack<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
	dictionary: MemDictionary<KeyInfos, TextInfos>,
	locales: OmnI18n.Locale[] = ['fr', 'en'],
	zones: OmnI18n.Zone[] = ['']
) {
	const server = new I18nServer(new WaitingDB(new MemDB(dictionary))),
		client = new I18nClient(locales, server.condense),
		T = client.enter(...zones)
	return { server, client, T }
}
