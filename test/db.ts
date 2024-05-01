import MemDB, { MemDBDictionary } from '../src/db/memDb'

// As this is for test purpose, actually wait even for direct-memory operations
function waiting<RV>(func: () => Promise<RV>) {
	return new Promise<RV>((resolve) => setTimeout(() => resolve(func()), 1))
}

export class WaitingDB implements OmnI18n.InteractiveDB {
	constructor(private db: OmnI18n.InteractiveDB) {}
	getZone(key: OmnI18n.TextKey, locales?: OmnI18n.Locale[]) {
		return waiting(() => this.db.getZone(key, locales))
	}
	modify(key: OmnI18n.TextKey, locale: OmnI18n.Locale, value: OmnI18n.Translation) {
		return waiting(() => this.db.modify(key, locale, value))
	}
	key(key: OmnI18n.TextKey, zone: OmnI18n.Zone) {
		return waiting(() => this.db.key(key, zone))
	}
	list(locales: OmnI18n.Locale[], zone: OmnI18n.Zone) {
		return waiting(() => this.db.list(locales, zone))
	}
	get(key: OmnI18n.TextKey) {
		return waiting(() => this.db.get(key))
	}
	workList(locales: OmnI18n.Locale[]): Promise<OmnI18n.WorkDictionary> {
		return waiting(() => this.db.workList(locales))
	}
	reKey(
		key: OmnI18n.TextKey,
		newKey?: OmnI18n.TextKey
	): Promise<{ zone: OmnI18n.Zone; texts: Record<OmnI18n.Locale, OmnI18n.Translation> }> {
		return waiting(() => this.db.reKey(key, newKey))
	}
}
