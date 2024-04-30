# OmnI18n

[Overview](https://github.com/emedware/omni18n/blob/main/README.md)

> :warning: **Work in progress!**

Projects using OmnI18n use it in 4 layers

1. [The `client`](./client.md): The client manages the cache and download along with providing [`Translator`s](./translator.md)
2. (optional) The HTTP or any other layer. This part is implemented by the user
3. The `server`: The server exposes functions to interact with the languages
4. The `database`: A class implementing some interface that interacts directly with a database
