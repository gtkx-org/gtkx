---
description: "Read Markdown files from a folder with Node's file APIs and list them in a GTK list view."
---

# List the Notes

Read the `.md` files in the notes folder with Node's `fs/promises` and list them, newest first, in a GTK list view.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Find the notes folder

`GLib.getUserSpecialDir` finds the Documents folder; Notes keeps its files in `Documents/Notes` and creates it when missing.

## Read the notes

`readdir`, `readFile` and `stat` from `node:fs/promises` turn each `.md` file into a `Note` with its name, text and modification time.

## Share the notes

A `NotesProvider` context loads the folder once and gives every screen the same notes.

## List the notes

A `ListView` from `@gtkx/components` shows each note's name and first line, with a spinner while the folder loads and a status page when it is empty. See [List components](/v2/guide/components#list-components).

## Run it

What to check in the running app.
