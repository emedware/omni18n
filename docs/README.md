# OmnI18n

The first document presents an [overview](../README.md), here is a more detailed description

Projects using OmnI18n use it in 4 layers

1. [The `client`](./client.md): The client manages the cache and download along with providing [`Translator`s](./translator.md) that will [interpolate](./interpolation.md)
2. (optional) The HTTP or any other layer. This part is implemented by the user
3. [The `server`](./server.md): The server exposes functions to interact with the languages
4. [The `database`](./db.md): A class implementing some interface that interacts directly with a database

## Bonus

### Flags

```js
import { localeFlags, flagCodeExceptions }
localeFlags('en-GB')	// ['🇬🇧']
localeFlags('en-US')	//['🇬🇧', '🇺🇸']
flagCodeExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
localeFlags('en-GB')	// ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧']
```
