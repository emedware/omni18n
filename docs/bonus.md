# Bonuses

## Flags

The library takes in consideration two cases:

- On systems who support flags emojis, flags will just be this, a 2~3 unicode characters that form the emoji
- On windows, the library `flag-icons` will be downloaded dynamically from [cdnjs.com](https://cdnjs.com/libraries/flag-icon-css) (~28k) and `localeFlag` will return a `<span...` string. This is done transparently client-side

Therefore,

Two `exceptions` lists are kept (one for emojis, one for flag class name): `flagEmojiExceptions` and `flagClassExceptions`. These are for languages who are not bound to a country (by default, it only contains `en` -> `gb`)

> Note: under windows, you won't see flags here beside '🏴󠁧󠁢󠁥󠁮󠁧󠁿' who is not even the correct one.

```js
import { localeFlagsEngine, flagEmojiExceptions }
const localeFlags = localeFlagsEngine('emojis')
localeFlags('en-GB')	// ['🇬🇧']
localeFlags('en-US')	//['🇬🇧', '🇺🇸']
flagEmojiExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
flagClassExceptions.en = 'gb-eng'
localeFlags('en-GB')	// ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧']
```

> Note: The returned strings must therefore be considered as html code, not pure text, even if for most, it will be pure text

`localeFlagsEngine` can be called either with an engine name (`emojis`/`flag-icons`) either with a userAgent (from the request header) either with nothing if called from the client.

`localeFlagsEngine` return a scpecific type (`LocaleFlagsEngine`) who has a property `headerContent` who perhaps contain a style node (html) to add to the header

### For client-only

The UMD client export a `localFlags` function, everything is automated (even adding the stylesheet reference if needed)

### For served content

The `localeFlagsEngine` function can be called with the `user-agent` request header.

In order to retrieve the engine name, when transferring data to "client" (SSR/browser), `localeFlags.name` can be used.

### But ... why ?

Why asking the server to tell the client if it runs on windows ? It's indeed the only way to solve two somehow contradictory issues :

- Make sure no extra download is done. Each Kb file to be downloaded is latency on mobile app
- Make sure there is no "blinking" on load (when the generated page differs from the `onMount` result), even on windows machines

## js-like "jsonability"

The dictionary uses a human "json" format. It's really minimalistic and didn't deserve the 25k of `json5` or `hjson`, it doesn't have more ability than json but:

- allows js-like comment
- uses indifferently <">, <'>, or <`> as quote markers
- does not need quotes for keys

The main difference with JavaScript is that all quotes behave the same than <`> for new lines:

```
{
	myMultilineString: "Hello
here"
}
```

The library exports the 2 functions `parse` and `stringify`.

The `maxLength` (2nd argument of `stringify`) specifies the maximum length an object/array can have on a line. When it exceeds this limit, the object/array is described with one line per element.

## Defer

The defer class allows to plan an action "on next tick" but let the code finish its modifications before actually doing it.

The callback can be given on constructor or when calling `.defer(...)`

You can get its `.promise` to wait (or `then`), get its instant `.deferring` status (boolean) or forcefully `.cancel()` or `.resolve()`
