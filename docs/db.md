# Database interface

## Structure

The main structure is `key -> translations`. In SQL, it would be translated as 2 tables:

- One for the key, the text-key - like "msg.greet" - being the primary key
- One for the translations, where the primary key is the couple (text-key, locale)

In mongo or json-oriented DB, a key object could directly give a list of translations `locale -> text`

The database interface is the one provided to the server. The first one is fairly simple:

```ts
export type RawDictionary = Record<TextKey, [Locale, Translation]>

interface DB {
	list(locales: Locale[], zone: Zone): Promise<RawDictionary>
}
```

That `list` function is a glorified `SELECT` who gives all keys given in a zone and, for them, the [_first locale from the given list_](./client.md#locales) that has a translation - and the translation of course

### Role in OmnI18n ecosystem

The DB role is purely to deal with a database. The [`server`](./server.md) will often mimic functions and their signature (`modify`, `reKey`, ...) and while the `server` role is to propagate information to both the client and the DB, a DB's role is purely the one of an adapter toward a database.

### Glorified strings

`Locale`, `Zone`, `TextKey`, `Translation` ... are basically strings.

## TranslatableDB

Translation occur with simple "select/upsert" operations. There is _no key management_ here, no structure management, just content edition

### ...Infos

Here, we get already in the realm where we can specify `KeyInfos` and `TextInfos`.

The former is given by developers, in english or some common language if comments are needed, it might contain the type (text/html/md/...) for the translation interface, &c. - and appear in the `keys` database

The latter more often used/edited by the translators and appearing in the `translations` database. (comment, "Keep the default value"="Do not translate" tag, &c.)

If a database implementation is meant to be generic, it should store the `...Infos` as json I guess or something, but an application can specify both these generic arguments _and_ the database adapter to deal with it.

```ts
 ...Infos extends {} = {}
```

### Work list

```ts
type WorkDictionaryText<TextInfos> = {
	text?: Translation
	infos?: TextInfos
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

> No `zone` fuss: this is read-only at this level, and it's not "the first translation", it's all of them.

This function is indeed used to populate translator's list for working on it ... working list.

### Translate

Sets the text/`TextInfo` for a given text-key/locale pair.

Returns the zone of the text-key if modified, `false` if the text-key was not found

> Write in the texts table, read in the keys table

```ts
modify(
	key: TextKey,
	locale: Locale,
	text: Translation,
	textInfos?: Partial<TextInfos>
): Promise<Zone | false>
```

## EditableDB

Provides edition for the developer. (note: the querying goes through `workList` of `TranslatableDB`)

```ts
key(key: string, zone: string, keyInfos?: Partial<KeyInfos>): Promise<boolean>
reKey(key: string, newKey?: string): Promise<{ zone: Zone; locales: Locale[] }>
```

`key` just upsert a key and its relative information.

`reKey` renames a key - into oblivion if no `newKey` (in the later case, removes also the translations)

## InteractiveDB

The last one has some little query functions used in interactive mode (ie. when the text changes should be populated to all clients when done)

```ts
get(key: string): Promise<Record<Locale, Translation>>
getZone(key: TextKey, locales?: Locale[]): Promise<Zone>
```

The first one retrieves the list of translations for a key, the second the key's zone IF some of the locales have a translation

## Provided providers

### MemDB

`MemDB` is an in-memory database (a pure JS object) who is build with its internal dictionary (`MemDBDictionary`)

### FileDB

FileDB is basically a MemDB with a file I/O ability. It is constructed with a file name and a `delay`, specifying the defer time between modifications and file writing (if a modification intervenes before file writing, the writing is deferred again to group it)

This allows:

- All the translations to simply be gathered under a file under source control (backup-able)
- The development activities (adding/removing/removing/rezoning a key) to be made and applied on commit/merge, and the "translation" (text-change) activities to still be available through the UI in real time

> :warning: The file should be in UTF-16 LE in strict `LF` mode

#### Recovering a file to export to a database

A `FileDB.analyze` function is exposed who takes the string to analyze and 2/3 callbacks

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
	[locale]:Some fancy translation
```

```
	[locale][{ SomeTextInfos: 'hjson format' }]:Some fancy translation
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
