# Static websites

Static websites will have to expose static translations files, import a library and initialize it with some data.

For now, the file `lib/omni18n.js` is the file to be copied and referred to in the html script tag.

Note: until now (1.1.8), the compressed library is 40k - it might be an overkill as the library is designed for fullstack optimization. The big thing that can still be profitable even in static websites is the [interpolation engine](./interpolation.md). And that it works out of the box.

## Script

UMD (static websites) use no zones (only the main one). Therefore, a global `T` variable is the only [Translator](./translator.md). An event is raised when it is loaded/changed

The regularly exported values are retrievable in the `OmnI18n` global variable, plus some more for UMD usage.

```ts
init(locales: Locale[], fileNameTemplate: string, rawType: RawType)
```

This has to be called once. Ex: `OmnI18n.init(['en', 'fr'], "/dictionaries/$.i18n")`

The locales are the ones whose dictionary file does exist, and the second argument gives the url of such files (where `$` is replaced by the locale)

The list of locales will be used:

- To filter navigator's defaults
- The first one will be used as default if no match is found
- To generate the language picker

Beside,

- `setLocale(locale: Locale)` In order to programmatically set the locale
- `onLocaleChange(cb: (locale: Locale) => void)` registers a callback to be called each time the global `T` is set
  - It means on first load and on language change
  - returns the unsubscribing function
- `locale` is the currently selected locale
- `i18nClient` is the globally used [I18nClient](./client.md)

## HTML

In the html, elements can have an `i18n` attribute:

```html
<h2 i18n="page.subtitle"></h2>
```

Though, the value can contain an attribute

```html
<input i18n="placeholder: fld.name.placeholder" ... />
```

And indeed, several attributes and the content separated by `,`s

### Generated language picker

If an element has an id `languages-list`, its content will be replaced on each page translation with the list of locales with a list of those:

```html
<button class="locale [selected]">
	<span class="flag">...</span>
	<span class="name">...</span>
</button>
```

Having a div id-ed such and some CSS is enough to have a default language picker.

## Static dictionary files

These are either `json-list`, `json-tree` or `omni18n`.

`json-list` are basically: one object `{[key: string]: string}`, one key -> one translation
`json-tree` are a hierarchical key-part -> sub-dictionary/translation (indeed, the internal representation)

```json
"key1": {
	"": "This is key one",
	"sub": "This is its sub-key"
}
```

`T.key1` and `T.key1.sub` are defined

### omni18n

This format is made to be usable by the machine and the human

There are even line comments beginning with `#`.

Idea: indentation based (**TABS** indentation based). The equivalent of the previous example is:

```
key1: This is key one
	sub: This is its sub-key
```

Notes:

- Multiline entries are surrounded with `<<<` and `>>>`
- Multiline entries that are supposed to be HTML directly begin with `<<<!`
- Multiline entries can by on one line: `<<<! <i>Ok!</i> >>>` is a valid html entry
