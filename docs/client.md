# Client part

The client part `I18nClient` is usually instantiated once per client.

For instance, in the browser for an SPA is is instantiated once for the whole web-application lifetime, while on the server-side for SSR, it might be instantiated once per request or per session.

In order to acquire translations, the client just has to `enter` a zone to retrieve a [Translator](./translator.md)

## With the server

```ts
I18nClient(locales: Locale[], condense: Condense, onModification?: OnModification)
```

- `locales`: A list of locales: from preferred to fallback
- `condense`: A function that will query the server for the condensed dictionary
- `onModification`: A function that will be called when the dictionary is modified

```ts
const client = new I18nClient(['fr', 'en'], server.condense, frontend.refreshTexts)
```

### Locales

Locales default to the more generic ones. Here, we can give several for fall-back purpose. In the case `['fr', 'en']`, if a french translation is not found while an english one is, the english version will be displayed while triggering the [`missing` report](./client.md#reports)

If the locales `['fr-CA', 'en-UK', 'de-DE']` are given, the actual list of locales that will be used is `['fr-CA', 'fr', '', 'en-UK', 'en', 'de-DE', 'de']`. The `missing` report will be called when the used locale is english or german.

## Reports

There are two ways to manage reports. There are also two report types : missing and error. The first one is for when a key is missing, the second one only happens when interpolating.

Both return a string to display instead of the translated value.

### Global reporting

`reports` is a variable imported from `omni18n` who can (and should) be edited. It is called by the engine reporting mechanism in case of problem. They both take an argument of type `TContext` describing mainly the client and the key where the problem occurred

```ts
export interface TContext {
	key: string
	zones: string[]
	client: I18nClient
}
```

These reports will:

- have any side effect, like logging or making a request that will log
- return a string that will be used instead of the expected translation

`reports` contain:

- A missing key report

```ts
reports.missing = ({ key, client }: TContext, fallback?: string) => {
	// report
	return fallback ?? `[${key}]`
}
```
> The fallback comes from a locale that was specified in the list the client' locale but was not first-choice

- An interpolation error
  When interpolating, an error calls this report with a textual description and some specifications depending on the error.

> The specification is json-able _except_ in the case of `error: "Error in processor"`, in which case `spec.error` is whatever has been thrown and might be an `Error`

```ts
reports.error = ({ key, client }: TContext, error: string, spec: object) => {
	// report
	return '[!error!]'
}
```

### OO reporting

Just override the `missing` and `error` members of `I18nClient` (who call the global `reports` by default)

```ts
missing(key: string, fallback: string | undefined, zones: Zone[]): string
error(key: string, error: string, spec: object, zones: Zone[]): string
```

## SSR: Between clients

In case of SSR, two clients are going to be instantiated: one on the client-side and one on the server-side.

We'll call them for commodity the client-side client (CSC) and server-side client (SSC).

When the application knows well it enters several zones while doing an action (like login-in if zoned by rights), it might be interesting for the SSC to provide a differential in the loaded dictionary in one packet instead of relying on further requests through the regular `condense` mechanism.

For this, **after** SSR-rendering, `payload = SSC.getPartialLoad(excludedZones: Zone[] = [])` can be called with the list of zones the CSC **already** possess. It will return a completely json-able in a compact format of the loaded dictionary

This partial answer can be conveyed in the answer with the action' results (especially useful in a page load action) and given to the CSC with `CSC.usePartial(payload)`