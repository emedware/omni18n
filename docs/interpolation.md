# Interpolation

A given value like `T.fld.name` will have a javascript value that can be converted to a string _and_ be called.

The function call will return a pure string and can take arguments.

The interpolation is done in `I18nClient::interpolate` and can of course be overridden.

## Arguments

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

## List cases

If the first element is a named list, the second one will be the case to take from the list.

example: `{question: ?, exclamation: !, default: ... | $1}`

> :information_source: The case `default` get the remaining cases and, if not specified, an error is raised if an inexistent case is given

## Sub translation

To use another translation can be useful, when for example one translation is a number format centralization common to all languages, or when a centralized (all-language) format string needs to use conjunctions or words that are language-specific.

The syntax `{other.text.key | arg1 | arg2}` can be used to do such.

## Processors

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

> :information_source: `{$2[upper] | $1}` is also possible, in which case the second argument can both specify a text key, a processor or be defaulted to the `upper` processor.

### Casing

- `upper(s)`
- `lower(s)`
- `title(s)`: uppercase-first

### Numeric formatting

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

### Other hard-coded

We of course speak about the ones hard-coded in the Intl javascript core of Node and the browsers.

- `relative(n, opt?)` where `n` is number+unit (ex. `1month` or `-2 seconds`) - just forwards to `Intl.RelativeTimeFormat`. Note that there is a `formats.relative` like for dates or number
- `DisplayNames`: relative to `Intl.DisplayNames`
  - `region(c)` ex: 'HU' -> "Hungary"
  - `language(c)` ex: 'en-UK' -> "British English"
  - `script(c)` ex: 'Kana' -> "Katakana"
  - `currency(c)` ex: 'USD' -> "Us dollars"

### Plurals and ordinals

These two processors use a specific key, respectively `internals.plurals` and `internal.ordinals`.
These key contain js-like object who, for english would be:

It can also be done by specifying `internals` as a js-like object or specifying `internals.plurals.one` as a string

```
ordinals: {one: '$st', two: '$nd', few: '$rd', other: '$th'}
numerals: {one: '$', other: '$s'}
```

The keywords (`one`, `other`, ...) come from [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules).

- `ordinal(n)` To display "1st", "2nd", ...
- `plural(n, spec)`:
  - If `spec` is a word, the `internals.plurals` rule is used (`{plural|1|cat}`-> "cat", `{plural|2|cat}`-> "cats").
  - The specification can use the `Intl.PluralRules` (ex: `{plural|$1|one:ox,other:oxen}`)
  - A specific case is made for languages who use `one/other` (like english) : `{plural|$1|ox|oxen}`