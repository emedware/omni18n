# geni18n

## Concepts

### Keys

Text keys are used as path, mostly beginning with a type (fld, msg, err, cmd, ...) and more sub-specification if needed.
- A key path can contain a translation AND sub-keys
- In such case, the most precise translation is used even if the sub-key does not exist

Example:
```json
{
	"fld.bday": "Birth date",
	"fld.bday.short": "B-dt",
	"fld.name": "Name"
}
```

In this case, *both* `T.fld.name` *and* `T.fld.name.short` will retrieve `"Name"`, so that, if the project use shortened notations, it can display T.fld[field].short without demanding all the fields to have a `short` version in all languages

### Locales

If we take the examples of `en-GB` and `en-US`, three locales are going to be used: `en-GB` and `en-US` of course and `en`, who will take care of all the common texts.
So, downloading `en-US` will download `en` overwritten with `en-US`.

### Zones

Zones are "software zones". Each user don't need the whole dictionary. Some texts for example are only used in administration pages and should not be downloaded by everyone.
A good way to divide zones for example is with a user's rights. Another way is even to have a zone per page/user-control. If zones are well entered/left, the whole needed dictionary will be loaded for the loaded page and complement added along browsing.

A special zone is `server` who will contain texts never downloaded by the client, like registration emails and other texts used server-side only

Zones are in trees. `admin.teams` will use the vocabulary of 3 zones: `admin.teams`, `admin` and the root zone ``.
Root zone that will contain all the common "Yes", "No", `internals`, ....

In case of PoC, only the root zone can be used.

Note: The library is optimized to download only the missing parts through a user's browsing experience

### `internals`

cf. local documentation. `geni18n` uses the standard JS Intl object. This object is able with a locale to determine some rules. For instance, english has 4 ways to make ordinals (1st, 2nd, 3rd, 4th) while french has 2 (this is already implemented in every browser and node)

These "internals" are used with specific translation features (like to use `{ordinal|$0} try...`) and should be the same for all websites.