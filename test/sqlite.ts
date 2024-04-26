// Made by mistake but is a good example of how to implement a database adapter
import { Database } from 'sqlite3'
import { open } from 'sqlite'

export async function sqlite(dbName: string) {
	const sqlite = await open({
		filename: `./db/${dbName}.db`,
		driver: Database
	})
	await sqlite.run('CREATE TABLE IF NOT EXISTS intl_key (key TEXT PRIMARY KEY, zone TEXT)')
	await sqlite.run(
		'CREATE TABLE IF NOT EXISTS intl_value (key TEXT, locale TEXT, value TEXT, PRIMARY KEY (key, locale))'
	)
	return {
		async isSpecified(key: string, locales: GenI18n.LocaleName[]) {
			return (
				(
					await sqlite.get({
						sql: `SELECT COUNT(*) AS count FROM intl_value WHERE key = ? AND locale IN (${locales.map(() => '?').join(', ')})`,
						values: [key, ...locales]
					})
				).count > 0
			)
		},
		// As this is for test only, we don't check if the texts are actually different than in DB
		async modify(key: string, locale: GenI18n.LocaleName, value: string) {
			if (
				(await sqlite.get({
					sql: 'SELECT COUNT(*) FROM intl_key WHERE key = ?',
					values: [key]
				})) === 0
			)
				throw new Error(`Key "${key}" not found`)
			await sqlite.run({
				sql: `INSERT OR REPLACE INTO intl_value (key, locale, value) VALUES (?, ?, ?)`,
				values: [key, locale, value]
			})
			return (
				await sqlite.get({
					sql: 'SELECT zone FROM intl_key WHERE key = ?',
					values: [key]
				})
			)?.zone
		},
		// As this is for test only, we don't check if the texts are actually different than in DB
		async key(key: string, zone: string, ...args: any[]) {
			await sqlite.run({
				sql: `INSERT OR REPLACE INTO intl_key (key, zone) VALUES (?, ?)`,
				values: [key, zone]
			})
		},
		async remove(key: string) {
			const rv = {
				locales: (
					await sqlite.all({
						sql: 'SELECT locale FROM intl_value WHERE key = ?',
						values: [key]
					})
				).map(({ locale }) => locale),
				zone: (
					await sqlite.get({
						sql: 'SELECT zone FROM intl_key WHERE key = ?',
						values: [key]
					})
				)?.zone
			}
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
			return rv
		},
		async list(locale: GenI18n.LocaleName, zones: string[]): Promise<GenI18n.RawDictionary> {
			return Object.fromEntries(
				(
					await sqlite.all({
						sql: `SELECT intl_key.key, intl_value.value FROM intl_key INNER JOIN intl_value ON intl_key.key = intl_value.key WHERE intl_value.locale = ? AND intl_key.zone IN (${zones.map(() => '?').join(', ')})`,
						values: [locale, ...zones]
					})
				).map(({ key, value }) => [key, value])
			)
		}
	}
}
