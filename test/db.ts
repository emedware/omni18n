import MemDB, { MemDictionary } from '../src/db/memDb'

// As this is for test purpose, actually wait even for direct-memory operations
function waiting<RV>(func: () => Promise<RV>) {
	return new Promise<RV>((resolve) => setTimeout(() => resolve(func()), 1))
}

export class WaitingDB implements OmnI18n.InteractiveDB {
	constructor(private db: OmnI18n.InteractiveDB) {}
	isSpecified(key: string, locales: OmnI18n.Locale[]) {
		return waiting(() => this.db.isSpecified(key, locales))
	}
	modify(key: string, locale: OmnI18n.Locale, value: string) {
		return waiting(() => this.db.modify(key, locale, value))
	}
	key(key: string, zone: string) {
		return waiting(() => this.db.key(key, zone))
	}
	list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		return waiting(() => this.db.list(locales, zone))
	}
	get(key: string) {
		return waiting(() => this.db.get(key))
	}
	workList(locales: string[]): Promise<OmnI18n.WorkDictionary> {
		return waiting(() => this.db.workList(locales))
	}
	reKey(key: string, newKey?: string): Promise<{ zone: string; locales: OmnI18n.Locale[] }> {
		return waiting(() => this.db.reKey(key, newKey))
	}
}
