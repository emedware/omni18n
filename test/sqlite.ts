import { Database } from 'sqlite3'
import { open } from 'sqlite'

export async function sqlite() {
	const sqlite = await open({
		filename: './db/tests.db',
		driver: Database
	})
	await sqlite.run('CREATE TABLE IF NOT EXISTS intl_key (key TEXT PRIMARY KEY, zone TEXT)')
	await sqlite.run('CREATE TABLE IF NOT EXISTS intl_value (key TEXT, locale TEXT, value TEXT, PRIMARY KEY (key, locale))')
	return {
		async modify(key: string, locale: Intl.UnicodeBCP47LocaleIdentifier, value: string) {
			await sqlite.run({
				sql: `INSERT OR REPLACE INTO intl_value (key, locale, value) VALUES (?, ?, ?)`,
				values: [key, locale, value]
			})
		},
		async create(key: string, zone: string) {
			await sqlite.run({
				sql: `INSERT OR REPLACE INTO intl_key (key, zone) VALUES (?, ?)`,
				values: [key, zone]
			})
		},
		async remove(key: string) {
			await Promise.all([
				sqlite.run({
					sql: `DELETE FROM intl_key WHERE key = ?`,
					values: [key]
				}),
				sqlite.run({
					sql: `DELETE FROM intl_value WHERE key = ?`,
					values: [key]
				})
			])
		},
		async list(locale: Intl.UnicodeBCP47LocaleIdentifier, zones: string[]): Promise<Geni18n.RawDictionary> {
			const qr = await sqlite.all({
					sql: `SELECT intl_key.key, intl_value.value FROM intl_key INNER JOIN intl_value ON intl_key.key = intl_value.key WHERE intl_value.locale = ? AND intl_key.zone IN (${zones.map(() => '?').join(', ')})`,
					values: [locale, ...zones]
				})
			const qrk = await sqlite.all('select * from intl_key'),
				qrt = await sqlite.all('select * from intl_value')
			return Object.fromEntries((
				qr
			).map(({key, value}) => [key, value]))
		}
	}
}