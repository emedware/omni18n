import { InteractiveDB, Locale, TextKey, Translation, WorkDictionary, Zone } from '~/server'

// As this is for test purpose, actually wait even for direct-memory operations
function waiting<RV>(func: () => Promise<RV>) {
	return new Promise<RV>((resolve) => setTimeout(() => resolve(func()), 1))
	// use this for debug purpose
	//return func()
}

export class WaitingDB implements InteractiveDB {
	constructor(private db: InteractiveDB) {}
	getZone(key: TextKey, locales?: Locale[]) {
		return waiting(() => this.db.getZone(key, locales))
	}
	modify(key: TextKey, locale: Locale, value: Translation) {
		return waiting(() => this.db.modify(key, locale, value))
	}
	key(key: TextKey, zone: Zone) {
		return waiting(() => this.db.key(key, zone))
	}
	list(locales: Locale[], zone: Zone) {
		return waiting(() => this.db.list(locales, zone))
	}
	get(key: TextKey) {
		return waiting(() => this.db.get(key))
	}
	workList(locales: Locale[]): Promise<WorkDictionary> {
		return waiting(() => this.db.workList(locales))
	}
	reKey(
		key: TextKey,
		newKey?: TextKey
	): Promise<{ zone: Zone; texts: Record<Locale, Translation> }> {
		return waiting(() => this.db.reKey(key, newKey))
	}
}
