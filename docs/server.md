# Server

The server class *shouldn't* have to be extended (now, you do what you want)

It is **not** instantiated client-side and is instantiated once/per request/per user on the server-side.

## Standard server

The usual use-case is to have a server instance created with a [`DB`](./db.md#structure) instance who provide a `condense` member.
```ts
type Condense = (locales: Locale[], zones: Zone[]) => Promise<CondensedDictionary[]>
```

This function never has to be called directly, just forwarded, nor overrode. Just give it straight forward to the client (with a `bind` if necessary, though the server `bind`s it in the constructor)

> Fun fact: Did you know the `$` character is escaped but not the `€` one ?

### Forwarding

> Don't c/p the code here, it never ran and is given for a structure example

On the client-side, shall it be UI/REST-api, communication with a worker, websocket, whatever:

#### Client-side

```ts
const condense: Condense = async (locales: Locale[], zones: Zone[]) => {
	const {locales: urlLocales, zones: urlZones} = Server.specs2url(locales, zones)
	const result = await fetch(`/condense?locales=${urlLocales}&zones=${urlZones}`)
	// if result.status is ok & stuff
	return <CondensedDictionary>(await result.json())
}
```

#### Server-side

```ts
app.get('/condense', async (req, res) => {
	const { locales, zones } = Server.url2specs(req.query.locales, req.query.zones)
	try {
		const result = await server.condense(locales, zones)
		res.json(result)
	} ...
})
```

## InteractiveServer

> Such a nerd idea

Imagine that you wish your application to shine so much that you want the translation modifications to appear directly at every client's desktop when a translator makes it, not on refresh.

Yes, that's how nerdy this `InteractiveServer` is - use only if you wish to.

1- An instance has to be created per *client tab* - or if you wish, make a service worker (but make a PR about it if you do)
2- Instances have to be `.destroy()`-ed when the channel is closed

Interactive servers are created with a second parameter:
```ts
(entries: Record<string, [string, string] | undefined>)=> Promise<void>
```
And, you guessed it, this one should just be forwarded to `OmnI18nClient::modified` through whichever medium you wish/can (I guess a websocket or such)

### Exposed interface

#### `InteractiveDB` forwards.
> To be called by the client

```ts
workList(locales: Locale[]): Promise<WorkDictionary>
modify(
	key: TextKey,
	locale: Locale,
	text: Translation,
	textInfos?: Partial<TextInfos>
): Promise<Zone | false>
key(
	key: TextKey,
	zone: Zone,
	translations: Record<Locale, Translation> = {},
	keyInfos?: Partial<KeyInfos>,
	textInfos?: Partial<TextInfos>
): Promise<void>
```

Only the `key` function differs as it takes the *translation modifications* as an argument (to *remove* a translation, specify `locale: undefined`)

#### DB notifications
> To be called by the DB

If a DB is reloaded or modified from another source and manage to have the event, one can raise the flag with:

```ts
modifiedKey(key: TextKey, zone: Zone): Promise<void>
modifiedText(key: TextKey, locale: Locale, text?: Translation): Promise<void>
```

#### End of modification batch

When all the modifications are done, the `propagate()` method can be called: it will propagate the events to all other `InteractiveServer` instances registered in the same `subscriptions` global variable (not accessible, just managed internally)

All the servers who are concerned by the modifications will use their `modified` call-back