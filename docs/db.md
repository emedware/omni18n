# Database interface

## Structure

The main structure is `key -> translations`. In SQL, it would be translated as 2 tables:

- One for the key, the text-key - like "msg.greet" - being the primary key
- One for the translations, where the primary key is the couple (text-key, locale)

In mongo or json-oriented DB, a key object could directly give a list of translations `locale -> text`

The database interface is the one provided to the server. The first one is fairly simple:

```ts
type RawDictionary = Record<string, [Locale, string]>

interface DB {
	list(locales: Locale[], zone: Zone): Promise<RawDictionary>
}
```

That `list` function is a glorified `SELECT` who gives all keys given in a zone and, for them, the [_first locale from the given list_](./client.md#locales) that has a translation - and the translation of course

### Role in OmnI18n ecosystem

The DB role is purely to deal with a database. The [`server`](./server.md) will often mimic functions and their signature (`modify`, `reKey`, ...) and while the `server` role is to propagate information to both the client and the DB, a DB's role is purely the one of an adapter toward a database.

## InteractiveDB

A kind of API has been designed for the server to be able to _modify_ the content of the DB : `InteractiveDB`.

### Infos

Here, we get already in the realm where we can specify `KeyInfos` and `TextInfos`. The former is given by developers, in english or some common language if text is needed - and appear in the `keys` database - and the `TextInfo`, more often used/edited by the translators and appearing in the `translations` database.

These are generic arguments - It means, if one implements a DB adapter, care should be taken to store/retrieve them - even if we don't know what structure they have. They all :

```ts
 ...Infos extends {} = {}
```

### Specific getters

#### Work list

```ts
type WorkDictionaryText<TextInfos> = {
	text: string
	infos: TextInfos
}
type WorkDictionaryEntry<KeyInfos, TextInfos> = {
	locales: { [locale: Locale]: WorkDictionaryText<TextInfos> }
	zone: Zone
	infos: KeyInfos
}
type WorkDictionary = Record<string, WorkDictionaryEntry>
workList(locales: Locale[]): Promise<WorkDictionary>
```

Given a list of locales, find all their translations

> No `zone` fuss, and it's not "the first translation", it's all of them.

This function is indeed used to populate translator's list for working on it ... working list.

#### Get a single key, check whether it is specified

```ts
get(key: string): Promise<Record<Locale, string>>
isSpecified(key: string, locales: Locale[]): Promise<undefined | {} | TextInfos>
```
