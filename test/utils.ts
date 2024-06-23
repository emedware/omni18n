import { I18nClient, I18nServer, Locale, MemDB, MemDBDictionary, Zone } from '~/server'
import { WaitingDB } from './db'

export function localStack<KeyInfos extends {} = {}, TextInfos extends {} = {}>(
	dictionary: MemDBDictionary<KeyInfos, TextInfos>,
	Client: typeof I18nClient = I18nClient,
	locales: Locale[] = ['fr', 'en'],
	zones: Zone[] = ['']
) {
	const server = new I18nServer(new WaitingDB(new MemDB(dictionary))),
		client = new Client(locales, server.condense),
		Tp = client.enter(...zones)
	return { server, client, Tp }
}
