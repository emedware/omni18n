[![view on npm](https://badgen.net/npm/v/omni18n)](https://www.npmjs.org/package/omni18n)
[![npm module downloads](https://badgen.net/npm/dt/omni18n)](https://www.npmjs.org/package/omni18n)
[![Github repo dependents](https://badgen.net/github/dependents-repo/emedware/omni18n)](https://github.com/emedware/omni18n/network/dependents?dependent_type=REPOSITORY)
[![NpmJs package dependents](https://badgen.net/github/dependents-pkg/emedware/omni18n)](https://github.com/emedware/omni18n/network/dependents?dependent_type=PACKAGE)
[![Node.js CI](https://github.com/emedware/omni18n/actions/workflows/node.js.yml/badge.svg)](https://github.com/emedware/omni18n/actions/workflows/node.js.yml)

<!-- [![Coverage Status](https://coveralls.io/repos/github/emedware/omni18n/badge.svg)](https://coveralls.io/github/emedware/omni18n) -->

# omni18n

Generic i18n library managing the fullstack interaction in a CI/CD pace. The fact the dictionaries are stored in a DB edited by the translators through a(/the same) web application - managing translation errors, missing keys, ...

It can even manage update of all (concerned) clients when a translation is modified

The main documentation on [GitHub pages](https://emedware.github.io/omni18n/) or in [the repository](./docs/README.md)

## General structure

The library is composed of a server part and a client part.

The server takes an object containing a `list` function that will query the DB and expose a `condensed` function that retrieve a condensed (processed) version of the dictionary for a locale (completely json-able).

The client part is a `I18nClient` that will remember a locale and manage the queries to the server and language changes
This client will produce `Translators` who are described in typescript by the type `any`, or you can specify yours for your dictionary structure.

### Server side

```ts
import { I18nServer, I18nClient } from 'omni18n'

const server = new I18nServer(myDBinterface)
const client = new I18nClient(['en-US'], server.condensed)
const T = await client.enter()

// Will both display the entry `msg.hello` for the `en-US` (or `en`) locale
console.log(T.msg.hello)
console.log(T('msg.hello'))
```

(on the client-side, the `condensed` argument is a function making an HTTP request)

### Full-stack usage

The full-stack case will insert the http protocol between `client` and `server`. The `condense` function takes few arguments and return a (promise of) json-able object so can go through an http request.

The "Omni" part is that it can be integrated for various asynchronous scenarios and in many frameworks.

### Interactive mode

In interactive mode (using `InteractiveServer`), the DB interface contains modification functions and the server exposes modification function, that will modify the DB but also raise events. In this case, an `InteractiveServer` instance has to be created for every client, with an interface toward the DB and a callback for event raising.

### DB-level

Two interfaces allow to implement an interface to any database: `OmnI18n.DB` (who basically just has a `list`) and `OmnI18n.InteractiveDB` who has some modification access

Two are provided: a `MemDB` who is basically an "in-memory database" and its descendant, a `FileDB` who allows:

- reading from a file
- maintaining the files when changes are brought

The `FileDB` uses a human-accessible (using [hjson](https://www.npmjs.com/package/hjson) for custom types) and based on `\t` indentation file format only proper for this usage.

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

In this case, _both_ `T.fld.name` _and_ `T.fld.name.short` will retrieve `"Name"`, so that, if the project use shortened notations, it can display `T.fld[field].short` without demanding all the fields to have a `short` version in all languages

Rule of the thumb: No value should be given as root keys. Every meaningful text has a category and should therefore be a sub-key

### Locales

If we take the examples of `en-GB` and `en-US`, four locales are going to be used: `en-GB` and `en-US` of course, `en` who will take care of all the common english texts and `''` (the empty-named local) who contains technical things common to all languages.
So, downloading `en-US` will download `''` overwritten with `en` then overwritten with `en-US`.

Common things are formats for example: `format.price: '{number|$2|style: currency, currency: $1}'` for prices allowing `T.format.price(currency, amount)`

#### Fallbacks

`I18nClient` is constructed with an array of locales. These are the locales "most preferred first". One can easily use the user's settings (often the interface propose "fallbacks") and add hard-coded the language(s) used by the developers.

### Zones

Zones are "software zones". Each user don't need the whole dictionary. Some texts for example are only used in administration pages and should not be downloaded by everyone.
A good way to divide zones for example is with a user's rights. Another way is even to have a zone per page/user-control. If zones are well entered, the whole needed dictionary will be loaded for the loaded page and complement added along browsing.

A special zone is `server` who will contain texts never downloaded by the client, like registration emails and other texts used server-side only

Zones are in trees. `admin.teams` will use the vocabulary of 3 zones: `admin.teams`, `admin` and the root zone ``.
Root zone that will contain all the common "Yes", "No", `internals`, ....

In case of PoC, only the root zone can be used.

> :information_source: The library is optimized to download only the missing parts through a user's browsing experience

> :warning: Zones are not different name spaces for text keys, each key is unique and has an associated zone

## Interpolation

A given value like `T.fld.name` will have a javascript value that can be converted to a string _and_ be called.

The function call will return a pure string and can take arguments.

The interpolation is done in `I18nClient::interpolate` and can of course be overridden.

### Arguments

> :information_source: While interpolating, the argument nr 0 is the key, the first argument is the argument nr 1. This is meant to be used by translators - literacy peeps - so of course the first argument has the number "1".

`"This is a {=1}"` will have to be called with an argument, `"This is a {=1|distraction}"` may be called with an argument.

If the content does not begin with the `=` sign, the content is a list separated by `|` where each element can be :

- A string
- An flat named list in the shape `key1: value1, key2: value2` where only `,` and `:` are used for the syntax.

> The `:` character triggers the list parsing. In order to used a ":" in a string, it has to be doubled "::" - The coma is escaped the same way: ",,"

The parameters (given in the code) can be accessed as such:
First, the last parameter is the one used for naming. If a named parameter is accessed, the last (or only) parameter should be an object with named properties

- `$0` is the key, `$1` the first argument, `$2`...
- `$arg` access the argument named `arg`
- `$` access the last argument (the names object)

To add a default, `$arg[default value]` can be used, as well as `$[name: John]`

To use the `$` character, it just has to be doubled: `$$`

The first element will determine how the whole `{...}` will be interpolated

### List cases

If the first element is a named list, the second one will be the case to take from the list.

example: `{question: ?, exclamation: !, default: ... | $1}`

> :information_source: The case `default` get the remaining cases and, if not specified, an error is raised if an inexistent case is given

### Sub translation

To use another translation can be useful, when for example one translation is a number format centralization common to all languages, or when a centralized (all-language) format string needs to use conjunctions or words that are language-specific.

The syntax `{other.intl.key | arg1 | arg2}` can be used to do such.

### Processors

The syntax also allow some processing specification, when a processor name (with no `.` in it) is used instead of a first element. The available processors can be extended :

```ts
import { processors, type TContext } from 'omni18n';

Object.assign(processors, {
	myProc(this: TContext, arg1: any, ...args: any[]) {
		...
	}
});
```

> :warning: For obvious security reasons, never `eval` a string argument

Where `TContext` contains mostly the `client` (the object containing all the language specification)
The arguments will mainly be strings or object when flat named lists are specified

The syntax to use them is `{processor | arg1 | arg2}`.

example: `{upper | $1}` will render the first argument in upper-case

> :information_source: `{$2[upper] | $1}` is also possible, in which case the second argument can both specify an intl key, a processor or be defaulted to the `upper` processor.

#### Casing

- `upper(s)`
- `lower(s)`
- `title(s)`: uppercase-first

#### Numeric formatting

- `number(n, opt?)`: equivalent to `Intl.NumberFormat()` who receive the list `opt` as options
- `date(n, opt?)`: equivalent to `Intl.DateTimeFormat()` who receive the list `opt` as options

A list of predefined options can be set in exported variables

```ts
import { formats } from 'omni18n'

formats.date.year = { year: 'numeric' }
formats.number.arabic = { numberingSystem: 'arab' }

const client: I18nClient = ...;
client.interpolate({key: '*', zones: [], client}, '{date|$0|year}', new Date('2021-11-01T12:34:56.789Z'));	// 2021
client.interpolate({key: '*', zones: [], client}, '{date|$0|month: numeric}', new Date('2021-11-01T12:34:56.789Z'));	// 11
```

Also, each client has a property `timeZone`. If set, it will be the default `timeZone` used in the options.
Its format is the one taken by `Date.toLocaleString()`

#### Other hard-coded

We of course speak about the ones hard-coded in the Intl javascript core of Node and the browsers.

- `relative(n, opt?)` where `n` is number+unit (ex. `1month` or `-2 seconds`) - just forwards to `Intl.RelativeTimeFormat`. Note that there is a `formats.relative` like for dates or number
- `DisplayNames`: relative to `Intl.DisplayNames`
  - `region(c)` ex: 'HU' -> "Hungary"
  - `language(c)` ex: 'en-UK' -> "British English"
  - `script(c)` ex: 'Kana' -> "Katakana"
  - `currency(c)` ex: 'USD' -> "Us dollars"

#### Plurals and ordinals

These two processors use a specific key, respectively `internals.plurals` and `internal.ordinals`.
These key contain js-like object who, for english would be:

It can also be done by specifying `internals` as a js-like object or specifying `internals.plurals.one` as a string

```
ordinals: {one: '$st', two: '$nd', few: '$rd', other: '$th'}
numerals: {one: '$', other: '$s'}
```

The keywords (`one`, `other`, ...) come from `Intl.PluralRules`.

- `ordinal(n)` To display "1st", "2nd", ...
- `plural(n, spec)`:
  - If `spec` is a word, the `internals.plurals` rule is used (`{plural|1|cat}`-> "cat", `{plural|2|cat}`-> "cats").
  - The specification can use the `Intl.PluralRules` (ex: `{plural|$1|one:ox,other:oxen}`)
  - A specific case is made for languages who use `one/other` (like english) : `{plural|$1|ox|oxen}`

## Error reporting

The library exposes on the client side `reports` as such:

```ts
import { reports, type TContext } from "omni18n";

/*interface TContext {
	key: string
	zones: string[]
	client: I18nClient
}*/

reports.missing = ({ key, client }: TContext, fallback?: string): string {
	// report
	return fallback ?? `[${key}]`
}
reports.error = (context: TContext, error: string, spec: object) {
	// report
	return `[!${error}]`
}
```

`specs` depends on the error. Mostly json-able (there might be some `Error` specification).

The function might do as much logging as they wish, the returned string will be the one used ad a "translation" (so, displayed)

## TODOs

- testing the error system
- detailed documentation on each part
