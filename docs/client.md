# Client part

The client part `I18nClient` is usually instantiated once per client.

For instance, in the browser for an SPA is is instantiated once for the whole web-application lifetime, while on the server-side for SSR, it might be instantiated once per request or per session.

In order to acquire translations, the client just has to `enter` a zone to retrieve a [Translator](./translator.md)

## Construction

```ts
I18nClient(locales: Locale[], condense: Condense, onModification?: OnModification)
```

- `locales`: A list of locales: from preferred to fallback (the list will be deduplicated internally so can be redundant)
- `condense`: A function that will query the server for the condensed dictionary
- `onModification`: A function that will be called when the dictionary is modified

```ts
const client = new I18nClient(['fr', 'en'], server.condense, frontend.refreshTexts)
```

### Locales

Locales default to the more generic ones. Here, we can give several for fall-back purpose. In the case `['fr', 'en']`, if a french translation is not found while an english one is, the english version will be displayed while triggering the [`missing` report](./client.md#reports)

If the locales `['fr-CA', 'en-UK', 'de-DE']` are given, the actual list of locales that will be used is `['fr-CA', 'fr', '', 'en-UK', 'en', 'de-DE', 'de']`. The `missing` report will be called when the used locale is english or german.

Setting the locales can be done with `i18nClient.setLocales([...])`.

> Note that duplicate locales will be deduplicated. To change the main language, don't change `locales[0]`, just `setLocales([newLocale, ...locales])`

### Other locales

The `I18nClient` also has 2 properties:

- `timeZone`: A timezone used when displaying dates (if none is specified) with [this format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- `currency`: A currency to use when displaying a number with `style: currency` (3-uppercase code: USD, EUR, ...)

## Reports

Reporting is done in 2 cases: interpolation error (as it involves TypeScript code to be executed with given arguments) who can come from wrong arguments given, bug in a processor, &c., along with missing key/translation errors. A `Missing key` error happens when no translation has been found at all, meaning the language containing that translation was not included in the fallbacks - or simply that the key does not exist. All errors should be reported to developers but the `Missing translation` that should be reported to translator(s)

The function `I18nClient::report(key: string, error: string, spec?: object): void` is the one called when something has to be reported (and by default does nothing)

The TypeScript-way is to have one's own `Client` class implementing `I18nClient` and overriding `report`, though a really low-level JavaScript-way might be to just replace `I18nClient.prototype.report`

### Reporting functions

`error` and `missing` are both `I18nClient` functions reporting. They also return a string to be displayed. `missing` can be called with a fallback, and if not, the default are `[${key}]` in case of missing and `[!${error}!]` in case of interpolation error.
On the server for example, these function can throw instead of returning a defaulted string in order not to send such emails

## SSR: Between clients

In case of SSR, two clients are going to be instantiated: one on the client-side and one on the server-side.

We'll call them for commodity the client-side client (CSC) and server-side client (SSC).

When the application knows well it enters several zones while doing an action (like login-in if zoned by rights), it might be interesting for the SSC to provide a differential in the loaded dictionary in one packet instead of relying on further requests through the regular `condense` mechanism.

For this, **after** SSR-rendering, `payload = SSC.getPartialLoad(excludedZones: Zone[] = [])` can be called with the list of zones the CSC **already** possess. It will return a completely json-able differential of the zones the CSC misses.

This partial answer can be conveyed in the answer with the action' results (especially useful in a page load action) and given to the CSC with `CSC.usePartial(payload)`

## Overriding `interpolate`

`I18nClient.interpolate` is called on _each_ translation, and can be used to add a transformation or have a list of "last 20 translations" in the translator's UI

## Native `Intl` helpers

Cached (taking care of locale change)

```ts
class I18nClient {
	...

	numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat
	listFormat(options: Intl.ListFormatOptions): Intl.ListFormat
	pluralRules(options: Intl.PluralRulesOptions): Intl.PluralRules
	relativeTimeFormat(options: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat
	displayNames(options: Intl.DisplayNamesOptions): Intl.DisplayNames
	dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat
}
```
