# geni18n

## Concepts

### Dialects

If we take the examples of `en-GB` and `en-US`, three dialects are going to be used: `en-GB` and `en-US` of course and `en`, who will take care of all the common texts.
So, downloading `en-US` will download `en` overwritten with `en-US`.

### Zones

Zones are "software zones". Each user don't need the whole dictionary. Some texts for example are only used in administration pages and should not be downloaded by everyone.
A good way to divide zones for example is with a user's rights.

A special zone is `server` who will contain texts never downloaded by the client, like registration emails and other texts used server-side only

Zones are in trees. `admin.teams` will use the vocabulary of 3 zones: `admin.teams`, `admin` and the root zone ``.
The root zone will contain all the common "Yes", "No", ....

In case of PoC, only the root zone can be used.

Note: The library is optimized to download only the missing parts through a user's browsing experience