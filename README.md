# OmnI18n

Generic i18n library managing the fullstack interaction in a CI/CD pace. The dictionaries are stored in a DB edited by the translators through a(/the same) web application - managing translation errors, missing keys, ...

- 1.1.x - [beta](https://www.youtube.com/watch?v=1gSZfX91zYk)

[![view on npm](https://badgen.net/npm/v/omni18n)](https://www.npmjs.org/package/omni18n)
[![npm module downloads](https://badgen.net/npm/dt/omni18n)](https://www.npmjs.org/package/omni18n)
[![Github repo dependents](https://badgen.net/github/dependents-repo/emedware/omni18n)](https://github.com/emedware/omni18n/network/dependents?dependent_type=REPOSITORY)
[![Node.js CI](https://github.com/emedware/omni18n/actions/workflows/node.js.yml/badge.svg)](https://github.com/emedware/omni18n/actions/workflows/node.js.yml)

<!--
[![NpmJs package dependents](https://badgen.net/github/dependents-pkg/emedware/omni18n)](https://github.com/emedware/omni18n/network/dependents?dependent_type=PACKAGE) -->

<!-- [![Coverage Status](https://coveralls.io/repos/github/emedware/omni18n/badge.svg)](https://coveralls.io/github/emedware/omni18n) -->

The main documentation is in [the repository](./docs/README.md)

## General structure

The library is composed of a server part and a client part.

The server:

- takes an [object containing a `list`](./docs/db.md) function that will query the DB
- exposes a `condense` function that retrieve a condensed (processed) version of the dictionary for a locale (completely json-able).

The client part is a [`I18nClient`](./docs/client.md) that will remember a locale and manage the queries to a server and language changes.
This client will produce [`Translator`](./docs/translator.md)s who make some wizardry like a proxy on a function that can be a string to describe text retrieval.

### Server side

> :information_source: For some obscure reasons, the library is completely working on [static applications](./docs/umd.md)

```ts
import { I18nServer, I18nClient } from 'omni18n'

const server = new I18nServer(myDBinterface)
const client = new I18nClient(['en-US'], server.condense)
// Here is where the actual DB-query occurs
const T = await client.enter()

// Will all display the entry `msg.hello` for the `en-US` (or `en`) locale
console.log(`${T.msg.hello}, ...`)
console.log(T.msg['hello'] + ', ...')
console.log(T('msg.hello') + ', ...')
```

### Full-stack usage

The full-stack case will insert the http protocol between [`client`](./docs/client.md) and [`server`](./docs/server.md). The `condense` function takes few json-able arguments and return a (promise of) json-able object so can go through an http request.

The "Omni" part is that it can be integrated for various asynchronous scenarios and in many frameworks.

`I18nServer` will never be instantiated in the browser, only a `condense` function that will be linked to an HTTP request

```ts
import { I18nClient, type Condense } from 'omni18n'

const fetchCondensed: Condense = async (locales: Locale[], zones: string[])=>  {
	...
	return result as CondensedDictionary[]
}
const client = new I18nClient(['en-US'], fetchCondensed)
// With many frameworks, dictionary data might be available on page load
client.usePartial(preloadedData)
// Here is where the actual download occurs if needed
const T = await client.enter()
```

The `usePartial` usage is described [here](./docs/client.md#ssr-between-clients)

### Interactive mode

In interactive mode (using [`InteractiveServer`](./docs/server.md#interactiveserver)), the DB interface contains modification functions and the server exposes modification function, that will modify the DB but also raise events. In this case, an `InteractiveServer` instance has to be created for every client, with an interface toward the DB and a callback for event raising.

### DB-level

Two interfaces allow to implement an interface to any database: [`DB`](./docs/db.md) (who basically just has a `list`) and [`InteractiveDB`](./docs/db.md#interactivedb) who has some modification access

Two are provided: a [`MemDB`](./docs/db.md#memdb) who is basically an "in-memory database" and its descendant, a [`FileDB`](./docs/db.md#filedb) who allows:

- reading from a file
- maintaining the files when changes are brought

The `FileDB` uses a human-accessible js-like format for custom types) and based on `\t` indentation file format only proper for this usage.

Having the translators managing translations in the UI while the devs have to access the file to add/remove keys, change their zone, ... and all this to go through git commits (so, to have local changes that will be integrated in the project after push/merge) can be done with `FileDB` - for this, just interface a `PUT` to a call on `InteractiveServer::modify` (while that server has a `FileDB` as a source) then the new file will be saved soon with the modified values.

## Concepts

### Keys

Text keys are used as path, mostly beginning with a type (fld, msg, err, cmd, ...) and more sub-specification if needed.

> :information_source: I personally use such shortcuts, but feel free to use "field", "message", ...

- A key path can contain a translation AND sub-keys
- In such case, the most precise translation is used even if the sub-key does not exist

Example:

```json
{
	"fld.bday": "Birth date",
	"fld.bday.short": "B-dt",
	"fld.name": "Name"
}
```

In this case, _both_ `T.fld.name` _and_ `T.fld.name.short` will retrieve `"Name"` so that, if the project uses shortened notations, it can display `T.fld[field].short` without demanding all the fields to have a `short` version in all languages

> Rule of the thumb: No value should be given as root keys. Every meaningful text has a category and should therefore be a sub-key. Also, some helpers function detect if there is a dot to identify text-keys vs. other kind of designations.

### Locales

If we take the examples of `en-GB` and `en-US`, four locales are going to be used: `en-GB` and `en-US` of course, `en` who will take care of all the common english texts and `''` (the empty-named local) who contains technical things common to all languages.
So, downloading `en-US` will download `''` overwritten with `en` then overwritten with `en-US`.

Common things are formats for example: `format.price: '{number::$2|style: currency, currency: $1}'` for prices allowing `T.format.price(currency, amount)`

#### Fallbacks

`I18nClient` is constructed with an array of locales. These are the locales "most preferred first". One can easily use the user's settings (often the interface propose "fallbacks") and add hard-coded the language(s) used by the developers.

### Zones

Zones are "software zones". Each user don't need the whole dictionary. Some texts for example are only used in administration pages and should not be downloaded by everyone.
A good way to divide zones for example is with a user's rights. Another way is even to have a zone per page/user-control. If zones are well entered, the whole needed dictionary will be loaded for the loaded page and complement added along browsing.

A special zone is `server` who will contain texts never downloaded by the client, like registration emails and other texts used server-side only

Zones are in trees. `admin.teams` will use the vocabulary of 3 zones: `admin.teams`, `admin` and the root zone ``.
Root zone that will contain all the common "Yes", "No", `internals`, ....

In case of PoC, only the root zone can be used.

> :information_source: The library is optimized to download only the missing parts through a user's browsing experience.

> :warning: Zones are not different name spaces for text keys, each key is unique and has an associated zone.

## Interpolation

[Interpolation](./docs/interpolation.md) occurs to all texts (even if no arguments are given) and basically convert `{...}` values using JS processors and/or the arguments.

It heavily relies on the [hard-coded Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) mechanism, especially for date/number formats as well as plural and ordinal formations.

Examples:

```
Hello {$1|here}
There {plural::$1|is|are} {number::$1} {plural::$1|entry|entries}
{number:: $price | style: currency, currency: $currency}
```

## Error reporting

[Error reporting](./docs/client.md#reports) can be done either with a [global value](./docs/client.md#global-reporting) as such:

```ts
import { reports, type TContext } from "omni18n/client";

reports.missing: ({ key, client }: TContext, fallback?: string) => string
reports.error: (context: TContext, error: string, spec: object) => string
```

Or the [object-oriented way](./docs/client.md#oo-reporting) by overriding these two reports function (who by default call the global values)

```ts
missing(key: string, fallback: Translation | undefined): string
error(key: string, error: string, spec: object): string
```

## Integrations

- [SvelteKit](https://github.com/eddow/omni18n-svelte4) - Svelte4
- [Nuxt](https://github.com/eddow/omni18n-vue) - Vue3
- [Editor](https://github.com/eddow/omni18n-edit/releases) - To edit `FileDB` dictionaries and give an idea of "translation page"

## TODO

- make the difference between a missing key (dev issue) or a missing translation in the key (translator issue)
- tests:
  - interpolation errors
  - deserialization errors
  - using client.onModification
  - UMD E2E

## Contributing

The best way to report a bug is to PR a failing unit test.

Any DB or framework adaptation can be published separately, just report it and the reference will be added here.

I made this functionality roughly ~10 times from scratch for a lot of different projects. It means the interface comes out of years of trials/errors/fixes and so there are few breaking changes to expect, if not none at all.
