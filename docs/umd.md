# Static websites

Static websites will have to expose static translations files, import a library and initialize it with some data.

For now, the file `lib/omni18n.js` is the file to be copied and referred to in the html script tag.

Note: until now (1.1.8), the compressed library is 40k - it might be an overkill as the library is designed for fullstack optimization. The big thing that can still be profitable even in static websites is the [interpolation engine](./interpolation.md). And that it works out of the box.

## Script

UMD (static websites) use no zones (only the main one). Therefore, a global `T` variable is the only [Translator](./translator.md). An event is raised when it is loaded/changed

The regularly exported values are retrievable in the `OmnI18n` global variable, plus some more for UMD usage.

```ts
init(locales: Locale[], fileNameTemplate: string)
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

### Script-less

A script-less way to use the library is by providing the arguments (`locales`, `fileNameTemplate`) directly in the script tag as js values
```html
<script src="/omni18n.js">["en", "fr"], "/dictionaries/$.js"</script>
```

`fileNameTemplate` is obsolete if all the needed locales are loaded on a hard-coded way

### Translation blinking

We speak about the "blink" when the page is just loaded and still displayed in its native language for half a second before being translated in the target language.

[*For now*](#todo), the solution needs to specify manually all the locales who shouldn't blink.
```html
<script src="dictionary_hu.js"></script>
```

Also, as many mobile webapp tend to let the resource loading at the end of the page, hurrying the translation by inserting a `translatePage` between the page content and the late loads (audio/scripts/...) can show useful.
```html
<script type="application/javascript">OmnI18n.translatePage()</script>
```

#### TODO

The script manually inserts a script element for the dictionary after itself when loading, in an attempt to make that script element to be waited before rendering.

It seems dynamically inserted script elements are not forcing the wait for the rendering.

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

A special (non-)attribute is `html`. Normally, the *text* is set. 

```html
<div i18n="html: long.termsAndConditions"></div>
```

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

Dictionary files are javascript files that have to be generated from a regular `I18nServer`.

A [script](../src/umd/extractLocales.ts) is provided to generate them from a [FileDB](./db.md#filedb) in `bin/extractLocales.mjs` and can easily be extended to any other DB source (it interfaces with `I18nServer` only)
