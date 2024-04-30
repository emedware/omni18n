# Client part

The client part `I18nClient` is usually instantiated once per client.

For instance, in the browser for an SPA is is instantiated once for the whole web-application lifetime, while on the server-side for SSR, it might be instantiated once per request or per session.

## Interactions and configurations

### With the server

```ts
I18nClient(locales: OmnI18n.Locale[], condense: OmnI18n.Condense, onModification?: OmnI18n.OnModification)
```

- `locales`: A list of locales: from preferred to fallback
- `condense`: A function that will query the server for the condensed dictionary
- `onModification`: A function that will be called when the dictionary is modified

```ts
const client = new I18nClient(['fr', 'en'], server.condense, frontend.refreshTexts)
```

### Global settings

These are variables you can import and modify:

```ts
import { reports, formats, processors } from 'omni18n'
```

#### `reports`

Reporting mechanism in case of problem. They both take an argument of type `TContext` describing mainly the client and the key where the problem occurred
```ts
export interface TContext {
	key: string
	zones: string[]
	client: I18nClient
}
```

> If texts might be displayed before loading is complete, make sure `onModification` has been specified as it will be called when the translations will be provided

These reports will:
- have any side effect, like logging or making a request that will log
- return a string that will be used instead of the expected translation

`reports` contain:

- A missing key report
```ts
reports.missing = ({ key, client }: TContext, fallback?: string)=> {
	// report
	return fallback ?? `[${key}]`
}
```

- A "missing key while loading" report
This one is called only when the client is in a loading state. If `onModification` was specified, it will be called once loaded. If not, the client will automatically check all the keys that went through this error to check them again.
```ts
reports.loading = ({ client }: TContext)=> '...'
```

- An interpolation error
When interpolating, an error calls this report with a textual description and some specifications depending on the error.

> The specification is json-able *except* in the case of `error: "Error in processor"`, in which case `spec.error` is whatever had been thrown and might be an `Error` or `Exception`
```ts
reports.error = ({ key, client }: TContext, error: string, spec: object)=> {
	// report
	return '[!error!]'
}
```

#### `formats`

#### `processors`