# Translators

`Translators` are the "magical object" that allows to dive into the dictionary.

A translator represent a `TContext`, meaning an [`I18nClient`](./client.md), zones and a text-key (so, potentially a translated text)

A translator `blup` can:
- `blup.subkey` or `blup['sub.key']`: Retrieve another translator for a sub-key
- `blup(1, 2, 3)`: Interpolate, optionally with arguments the translated key
- `"Here: " + blup`: Be interpreted as a string, in which case it will interpolate without arguments
- 
> :warning: :hotsprings: `blup.then` returns an object that throws errors when accessed! 
> If `blup.then` would return a translator, therefore a function, it would look like "thenable" and therefore make bugs when returned from a promise

## Life of a translator

> Shall no one take it personally

A main translator is created with 
```js
const T = await client.enter('zone1', 'zone2')
```

>The `await` part come from the fact the client might have to download some parts of the dictionary. It happens few, but it happens at least each time a page is rendered/a server is launched.

This is a "root translator" and, therefore, its call takes a key as first argument: `T('my.key', ...)`, but is a regular translator in all other regards

Other translators are simply "sub-translators" and need no awaiting.

## Utility functions

```js
function getContext(translator: Translator): TContext
```

Beside this `getContext`, some libraries expose a way to be dynamically translated by taking an object of translations. By example:

```js
{
	tooLong: "The text is too long",
	empty: "The text shouldn't be empty",
	play: "Same player, try again"
}
```

There are two ways to produce such objects and make sure to produce texts exempt of `Translator` wizardry for the library to use.

### Bulk from objects

A `Translatable` is just an object whose leafs are string. The function `bulkObject` gives you a translated object from a keyed object. It allows you to define these objects format outside of the dynamism of a translator, then use it.

```ts
const T = await client.enter('myLib')
myLibrary.messages = bulkObject(T, {
	tooLong: 'err.thatLib.tooLong',
	empty: 'err.thatLib.empty',
	play: 'msg.thatLib.play',
}, ...args);
```

### Bulk from the dictionary

Another way let that library' structure be described directly in the dictionary
> Don't forget that translators can read keys and write texts, only developers edit the keys

Imagining the dictionary contains these keys:
- `groups.thatLib.tooLong`
- `groups.thatLib.empty`
- `groups.thatLib.play`

We can now call
```ts
const T = await client.enter('myLib')
myLibrary.messages = bulkDictionary(T.groups.thatLib, ...args)
```
