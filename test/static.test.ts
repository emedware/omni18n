import I18nServer from '../src/server'
import Locale from '../src/locale'
import { Zone, directMem } from './db'

describe('Static functionality', () => {
	// This is for test purpose: in general usage, only one locale/T is used
	let T: Record<string, any>,
		locales: Record<string, Locale>,
		loads: any[] = []

	beforeAll(async () => {
		const server = new I18nServer(
			directMem({
				'fld.name': { en: 'Name', fr: 'Nom', [Zone]: '' },
				'fld.bdate': { en: 'Birthday', fr: 'Date de naissance', [Zone]: '' },
				'fld.bdate.short': { en: 'B-dy', [Zone]: '' },
				'msg.greet': {
					en: 'Hello {0|here}',
					fr: 'Salut {0|tout le monde}',
					'fr-BE': "Salut {0|m'fi}",
					[Zone]: ''
				},
				'cmd.ban': { en: 'Ban user', fr: "Bannir l'utilisateur", [Zone]: 'adm' },
				'specs.animal': {
					en: '{0} {plural|$0|ox|oxen}',
					fr: '{0} {plural|$0|one:cheval,other:chevaux}',
					[Zone]: ''
				},
				'specs.cat': { en: '{0} {plural|$0|cat}', fr: '{0} {plural|$0|chat}', [Zone]: '' },
				'specs.number': { '': '{number|$0}', [Zone]: '' },
				'specs.price': { '': '{number|$1|style: currency, currency: $0}', [Zone]: '' },
				'specs.ordinal': { '': '{ordinal|$0}', [Zone]: '' },
				'internals.ordinals': {
					en: "{one: '$st', two: '$nd', few: '$rd', other: '$th'}",
					fr: "{one: '$er', other: '$ème'}",
					[Zone]: ''
				},
				'internals.plurals': {
					en: "{one: '$', other: '$s'}",
					fr: "{one: '$', other: '$s'}",
					[Zone]: ''
				}
			})
		)

		function condense(locale: Geni18n.LocaleName, zones: string[] = ['']) {
			loads.push({ locale, zones })
			return server.condense(locale, zones)
		}
		locales = { en: new Locale('en-US', condense), be: new Locale('fr-BE', condense) }
		locales.en.enter('adm')
		await Promise.all(Object.values(locales).map((locale) => locale.loaded))
		T = Object.fromEntries(Object.entries(locales).map(([key, value]) => [key, value.translation]))
	})

	test('zones', async () => {
		expect(loads).toEqual([
			{ locale: 'en-US', zones: ['', 'adm'] },
			{ locale: 'fr-BE', zones: [''] }
		])
		expect(T.be.cmd.ban()).toBe('[cmd.ban]')
		loads = []
		locales.be.enter('adm')
		await locales.be.loaded
		expect(loads).toEqual([{ locale: 'fr-BE', zones: ['adm'] }])
		expect(T.en.cmd.ban()).toBe('Ban user')
		expect(T.be.cmd.ban()).toBe("Bannir l'utilisateur")
	})

	test('several kind of text access', () => {
		const fields = T.en.fld
		expect('' + fields.name).toBe('Name')
		expect('' + fields.name.short).toBe('Name')
		expect('' + fields.bdate.short).toBe('B-dy')
		expect(fields.name()).toBe('Name')
		expect('' + fields['name']).toBe('Name')
		expect(T.en['fld.name']()).toBe('Name')
	})

	test('simple arguments', () => {
		expect(T.en.msg.greet()).toBe('Hello here')
		expect(T.en.msg.greet('world')).toBe('Hello world')
		expect(T.be.msg.greet()).toBe("Salut m'fi")
		expect(T.be.msg.greet('tout le monde')).toBe('Salut tout le monde')
	})

	test('dialect management', () => {
		expect(T.be.msg.greet()).toBe("Salut m'fi")
		expect(T.be.fld.name()).toBe('Nom')
	})

	test('plurals', () => {
		expect(T.en.specs.animal(1)).toBe('1 ox')
		expect(T.en.specs.animal(2)).toBe('2 oxen')
		expect(T.be.specs.animal(1)).toBe('1 cheval')
		expect(T.be.specs.animal(2)).toBe('2 chevaux')

		expect(T.en.specs.cat(1)).toBe('1 cat')
		expect(T.be.specs.cat(2)).toBe('2 chats')
	})

	test('ordinals', () => {
		expect(T.en.specs.ordinal(1)).toBe('1st')
		expect(T.en.specs.ordinal(2)).toBe('2nd')
		expect(T.en.specs.ordinal(3)).toBe('3rd')
		expect(T.en.specs.ordinal(4)).toBe('4th')
		expect(T.en.specs.ordinal(11)).toBe('11th')
		expect(T.en.specs.ordinal(12)).toBe('12th')
		expect(T.en.specs.ordinal(13)).toBe('13th')
		expect(T.en.specs.ordinal(14)).toBe('14th')
		expect(T.en.specs.ordinal(21)).toBe('21st')
		expect(T.en.specs.ordinal(22)).toBe('22nd')
		expect(T.en.specs.ordinal(23)).toBe('23rd')
		expect(T.en.specs.ordinal(24)).toBe('24th')
		expect(T.en.specs.ordinal(111)).toBe('111th')
		expect(T.en.specs.ordinal(112)).toBe('112th')
		expect(T.en.specs.ordinal(113)).toBe('113th')
		expect(T.en.specs.ordinal(114)).toBe('114th')
		expect(T.en.specs.ordinal(121)).toBe('121st')
		expect(T.en.specs.ordinal(122)).toBe('122nd')
		expect(T.en.specs.ordinal(123)).toBe('123rd')
		expect(T.en.specs.ordinal(124)).toBe('124th')

		expect(T.be.specs.ordinal(1)).toBe('1er')
		expect(T.be.specs.ordinal(2)).toBe('2ème')
		expect(T.be.specs.ordinal(3)).toBe('3ème')
		expect(T.be.specs.ordinal(4)).toBe('4ème')
		expect(T.be.specs.ordinal(11)).toBe('11ème')
		expect(T.be.specs.ordinal(12)).toBe('12ème')
	})

	test('number', () => {
		// Warning: direct strings fail as the "space" used is some kind of special "&nbsp;" or sth
		const big = 123456789.123,
			price = 52.52
		expect(T.en.specs.number(big)).toBe(big.toLocaleString('en-US'))
		expect(T.en.specs.price('USD', price)).toBe(
			price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
		)
		expect(T.be.specs.number(big)).toBe(big.toLocaleString('fr-BE'))
		expect(T.be.specs.price('EUR', price)).toBe(
			price.toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })
		)
	})
})
