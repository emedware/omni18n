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

A kind of API has been designed for the server to be able to _modify_ the content of the DB.

### Infos

Here, we get already in the realm where we can specify `KeyInfos` and `TextInfos`. The former is given by developers, in english or some common language if text is needed - and appear in the `keys` database - and the `TextInfo`, more often used/edited by the translators and appearing in the `translations` database.

If a database implementation is meant to be generic, it should store the `...Infos` as json I guess or something, but an application can specify both these generic arguments _and_ the database adapter to deal with it.

The `KeyInfo` might store information like notes from the dev, a flag to know if the text is pure, html, md, ... Whatever concerns development.

The `Textinfo` might store translation notes I guess, a link to a discussion with chatGPT, I really don't know - in case of doubt, let the default `{}`

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
	texts: { [locale: Locale]: WorkDictionaryText<TextInfos> }
	zone: Zone
	infos: KeyInfos
}
type WorkDictionary = Record<string, WorkDictionaryEntry>
workList(locales: Locale[]): Promise<WorkDictionary>
```

Given a list of locales, find all their translations

> No `zone` fuss, and it's not "the first translation", it's all of them.

This function is indeed used to populate translator's list for working on it ... working list.

#### Get a single key, check whether a translation is specified

```ts
get(key: string): Promise<Record<Locale, Translation>>
getZone(key: TextKey, locales?: Locale[]): Promise<Zone>
```

The first one retrieves the list of translations for a key, the second the key's zone IF some of the locales have a translation

### Setters

#### Translate

> Write in the texts table, read in the keys table

```ts
modify(
	key: string,
	locale: Locale,
	text: string,
	textInfos?: Partial<TextInfos>
): Promise<string | false>
```

Sets the text/`TextInfo` for a given text-key/locale pair.

Returns the zone of the text-key if modified, `false` if the text-key was not found

#### Key management

```ts
key(key: string, zone: string, keyInfos?: Partial<KeyInfos>): Promise<boolean>
reKey(key: string, newKey?: string): Promise<{ zone: string; locales: Locale[] }>
```

`key` just upsert a key and its relative information.

`reKey` renames a key - into oblivion if no `newKey` (in the later case, remove also the translations)

## Provided providers

### MemDB

`MemDB` is an in-memory database (a pure JS object) who is build with its internal dictionary (`MemDBDictionary`)

### FileDB

FileDB is basically a MemDB with a file I/O ability. It is constructed with a file name and a `delay`, specifying the defer time between modifications and file writing (if a modification intervenes before file writing, the writing is deferred again to group it)

This allows:

- All the translations to simply be gathered under a file under source control (backup-able)
- The development activities (adding/removing/removing/rezoning a key) to be made and applied on commit/merge, and the "translation" (text-change) activities to still be available through the UI in real time

#### Recovering a file to export to a database

An `FileDB.analyze` function is exposed who takes the string to analyze and 2/3 callbacks
- `onKey` called when a new key is discovered
- `onText` called when a translation is discovered
- `endKey?` called when the key is finished

For each key, the callback calls will be `onKey - onText* - endKey` for each key

#### File format

The serialization file-format is specific for regexp-ability _and_ human interactions; grouping is done by indentation (made with tabulations - `\t`).

`KeyInfos` and `TextInfos` are stored in [`hjson`](https://www.npmjs.com/package/hjson) format

##### 0-tabs

A line beginning with no tabs is a key specification

```
[text-key]:[zone]
```

```
[text-key][{ SomeKeyInfos: 'hjson format' }]:[zone]
```

> Note: the zone can and will often be `""`

##### 1-tab

A line beginning with one tab is a locale specification for the key "en cours"

```
	[locale]:
```

```
	[locale][{ SomeTextInfos: 'hjson format' }]:
```

##### 2-tabs

A line beginning with two tabs is the _continuation_ of the translation.

```
	[locale]:Line1
		Line2
```

Will specify `locale: "Line1\nLine2"`

##### 3-tabs

A line beginning with three tabs is the continuation of a translation containing a tab ... &c.
