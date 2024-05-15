# OmnI18n

The first document presents an [overview](../README.md), here is a more detailed description

Projects using OmnI18n use it in 4 layers

1. [The `client`](./client.md): The client manages the cache and download along with providing [`Translator`s](./translator.md) that will [interpolate](./interpolation.md)
2. (optional) The HTTP or any other layer. This part is implemented by the user
3. [The `server`](./server.md): The server exposes functions to interact with the languages
4. [The `database`](./db.md): A class implementing some interface that interacts directly with a database

## Entry points

The library has 2x2 entry points:

client/server: The server functionalities are not needed **and** harmful on client-side (try to ask chrome to import `node:fs` ...)

- The complete library `omni18n`
- The client part `omni18n/client`

bundled/source: The sources (TypeScript) are provided so that you can use your favorite bundler/debugger

- The bundled `omni18n`
- The source `omni18n/src`

And of course `omni18n/src/client` for the 2x2...

### umd

On the client side, it is also possible to reference the file `lib/omni18n.js` statically in the HTML code, every functionality will be in the `OmnI18n` global variable.

## Bonus

### Flags

```js
import { localeFlags, flagCodeExceptions }
localeFlags('en-GB')	// ['🇬🇧']
localeFlags('en-US')	//['🇬🇧', '🇺🇸']
flagCodeExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
localeFlags('en-GB')	// ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧']
```
