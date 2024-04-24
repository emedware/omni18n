# geni18n

## Concepts

### Keys

Text keys are used as path, mostly beginning with a type (fld, msg, err, cmd, ...) and more sub-specification if needed.

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

In this case, _both_ `T.fld.name` _and_ `T.fld.name.short` will retrieve `"Name"`, so that, if the project use shortened notations, it can display T.fld[field].short without demanding all the fields to have a `short` version in all languages

### Locales

If we take the examples of `en-GB` and `en-US`, three locales are going to be used: `en-GB` and `en-US` of course, `en` who will take care of all the common english texts and `''` (the empty-named local) who contains technical things common to all languages.
So, downloading `en-US` will download `''` overwritten with `en` then overwritten with `en-US`.

Common things example: `format.price: '{number|$1|style: currency, currency: $0}'` for prices allowing `T.format.price(currency, amount)`

### Zones

Zones are "software zones". Each user don't need the whole dictionary. Some texts for example are only used in administration pages and should not be downloaded by everyone.
A good way to divide zones for example is with a user's rights. Another way is even to have a zone per page/user-control. If zones are well entered/left, the whole needed dictionary will be loaded for the loaded page and complement added along browsing.

A special zone is `server` who will contain texts never downloaded by the client, like registration emails and other texts used server-side only

Zones are in trees. `admin.teams` will use the vocabulary of 3 zones: `admin.teams`, `admin` and the root zone ``.
Root zone that will contain all the common "Yes", "No", `internals`, ....

In case of PoC, only the root zone can be used.

Note: The library is optimized to download only the missing parts through a user's browsing experience

Warning: Zones are not different `namespaces` for text keys

### `internals`

cf. local documentation. `geni18n` uses the standard JS Intl object. This object is able with a locale to determine some rules. For instance, english has 4 ways to make ordinals (1st, 2nd, 3rd, 4th) while french has 2 (this is already implemented in every browser and node)

These "internals" are used with specific translation features (like to use `{ordinal|$0} try...`) and should be the same for all websites.

## Interpolation

A given value like `T.fld.name` will have a javascript value that can be converted in a string _and_ be called.

The function call will return a pure string and can take arguments

### Direct arguments

`"This is a {0}"` will have to be called with an argument, `"This is a {0|distraction}"` may be called with an argument.

### Processors

The syntax also allow some processing specification. The available processors are here and can be extended :

```ts
import { processors } from 'geni18n'
```

The syntax to use them is `{processor | arg1 | arg2}`, any part can use `$0`, `$1[default]`, ... to access a given parameter optionally giving it a default value.
Some arguments are named list and the only format is a flat one `key1: value1, key2: value2` where only `,` and `:` are used for the syntax.

example: `{upper | $0}` will render the first argument in upper-case

#### List

- `upper(s)`
- `lower(s)`
- `title(s)`: uppercase-first
- `number(n, opt?)`: equivalent to `Intl.NumberFormat()` who receive the list `opt` as options
- `cases(s, cases)`: The cases is a list, and `s` is the key to chose what to display

#### Plurals and ordinals

These two processors use a specific key, respectively `internals.plurals` and `internal.ordinals`.
These key contain js-like object who, for english would be:

```
ordinals: {one: '$st', two: '$nd', few: '$rd', other: '$th'}
numerals: {one: '$', other: '$s'}
```

The keywords (`one`, `other`, ...) come from `Intl.PluralRules`.

- `ordinal(n)` To display "1st", "2nd", ...
- `plural(n, spec)`:
  - If `spec` is a word, the `internals.plurals` rule is used (`{plural|1|cat}`-> "cat", `{plural|2|cat}`-> "cats").
  - The specification can use the `Intl.PluralRules` (ex: `{plural|$0|one:ox,other:oxen}`)
  - A specific case is made for languages who use `one/other` (like english) : `{plural|$0|ox|oxen}`
