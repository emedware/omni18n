# Omni18n Documentation

## Overview
Omni18n is a full-stack internalization library designed for partial loading ("Zones") and complex interpolation.

## Core Concepts
*   **Zones**: Software zones (e.g., `admin`, `login`). Clients only download translations for the zones they currently need, not the entire dictionary.
*   **Interpolation**: Uses `Intl` under the hood. Supports complex pipes: `{number::$price | style: currency}`.
*   **Architecture**:
    *   **Server**: Serves condensed dictionaries.
    *   **Client**: Manages cache and requests missing zones.

## Keys & usage
*   **Path Access**: `T.key1.key2` retrieves the translation for `key1.key2`.
    *   **Reusability**: `const k1 = T.key1; // k1.key2 -> T.key1.key2`
*   **Stringable & Callable**: The retrieved object is stringable (returns the text) AND callable (for arguments).
    *   **Positional**: `T.msg.greet('John')` -> "Hello {1}" -> "Hello John".
    *   **Named**: `T.msg.greet({ name: 'John' })` -> "Hello {name}".
*   **Structure**: Keys are hierarchical (`fld.name`). Sub-keys (e.g. `short`) allow variations.
