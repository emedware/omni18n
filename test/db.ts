import JsonDB, { JsonDictionary } from '../src/json-db'

// As this is for test purpose, actually wait even for direct-memory operations
function waiting<RV>(func: () => Promise<RV>) {
	return new Promise<RV>((resolve) => setTimeout(() => resolve(func()), 1))
}

export class WaitingJsonDb implements GenI18n.InteractiveDB {
	private db: JsonDB
	constructor(dictionary: JsonDictionary) {
		this.db = new JsonDB(dictionary)
	}
	isSpecified(key: string, locales: GenI18n.LocaleName[]) {
		return waiting(() => this.db.isSpecified(key, locales))
	}
	modify(key: string, locale: GenI18n.LocaleName, value: string) {
		return waiting(() => this.db.modify(key, locale, value))
	}
	key(key: string, zone: string) {
		return waiting(() => this.db.key(key, zone))
	}
	remove(key: string) {
		return waiting(() => this.db.remove(key))
	}
	list(locales: GenI18n.LocaleName[], zone: GenI18n.Zone) {
		return waiting(() => this.db.list(locales, zone))
	}
	get(key: string) {
		return waiting(() => this.db.get(key))
	}
}
