# Databases implementation

These are the implementations of `OmnI18n.InteractiveDB`

## JSonDB

In-memory "DB", initialized with a structured `JsonDictionary` dictionary

## FileDB

A `JsonDB` that uses a file as a source and persists its change to the file system.

Note, a human-readable format is used using mostly indent (tabs) to group keys and texts