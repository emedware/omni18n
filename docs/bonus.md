# Bonuses

## Flags

The library takes in consideration two cases:

- On systems who support flags emojis, flags will just be this, a 2~3 unicode characters that form the emoji
- On windows, the library `flag-icons` will be downloaded dynamically from [cdnjs.com](https://cdnjs.com/libraries/flag-icon-css) (~28k) and `localeFlag` will return a `<span...` string. This is done transparently client-side

Note, the generic behavior can be set with `setFlagEngine` (taking `'emojis' | 'flag-icons'` ), even though it should be hydrated dynamically

Two `exceptions` lists are kept (one for emojis, one for flag class name): `flagEmojiExceptions` and `flagClassExceptions`. These are for languages who are not bound to a country (by default, it only contains `en` -> `gb`)

> Note: under windows, you won't see flags here beside '🏴󠁧󠁢󠁥󠁮󠁧󠁿' who is not even the correct one.

```js
import { localeFlags, flagCodeExceptions }
localeFlags('en-GB')	// ['🇬🇧']
localeFlags('en-US')	//['🇬🇧', '🇺🇸']
flagEmojiExceptions.en = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
flagClassExceptions.en = 'gb-eng'
localeFlags('en-GB')	// ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇧']
```

> Note: The returned strings must therefore be considered as html code, not pure text, even if for most, it will be pure text

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
