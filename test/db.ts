import JsonDB from '../src/json-db'
import { InteractiveDB } from '../src/server'

// As this is for test purpose, actually wait even for direct-memory operations
function waiting<RV>(func: () => Promise<RV>) {
	return new Promise<RV>((resolve) => setTimeout(() => resolve(func()), 1))
}

export class WaitingJsonDb extends JsonDB {
	isSpecified(key: string, locales: GenI18n.LocaleName[]) {
		return waiting(() => super.isSpecified(key, locales))
	}
	modify(key: string, locale: GenI18n.LocaleName, value: string) {
		return waiting(() => super.modify(key, locale, value))
	}
	key(key: string, zone: string) {
		return waiting(() => super.key(key, zone))
	}
	remove(key: string) {
		return waiting(() => super.remove(key))
	}
	list(locale: GenI18n.LocaleName, zones: string[]) {
		return waiting(() => super.list(locale, zones))
	}
}
