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

<<< @/figures/tutorial/the-notes-folder/src/notes/files.ts [src/notes/files.ts]

## Read the notes

`readdir`, `readFile` and `stat` from `node:fs/promises` turn each `.md` file into a `Note` with its name, text, modification time and first line of text.

<<< @/figures/tutorial/the-notes-folder/src/notes/note.ts [src/notes/note.ts]

## Share the notes

A `NotesProvider` context loads the folder once and gives every screen the same notes.

<<< @/figures/tutorial/the-notes-folder/src/notes/notes-provider.tsx [src/notes/notes-provider.tsx]

## List the notes

A `ListView` from `@gtkx/components` shows each note's name and first line, with a spinner while the folder loads and a status page when it is empty. See [List components](/v2/guide/components#list-components).

<<< @/figures/tutorial/the-notes-folder/src/components/notes-screen.tsx [src/components/notes-screen.tsx]

The window renders the screen inside the provider.

<<< @/figures/tutorial/the-notes-folder/src/app.tsx [src/app.tsx]

## Run it

Add a few `.md` files to `Documents/Notes` and restart `npm run dev`. The window lists them, newest first.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-notes-folder-light.png" width="360" height="294" loading="lazy" alt="The Notes window listing five notes, newest first: Website relaunch, Meeting notes, Trip to Lisbon, Book club and Recipes, each name above its first line of text in dimmed type." />
    <img class="result-dark" src="/figures/tutorial-the-notes-folder-dark.png" width="360" height="294" loading="lazy" alt="The Notes window listing five notes, newest first: Website relaunch, Meeting notes, Trip to Lisbon, Book club and Recipes, each name above its first line of text in dimmed type." />
    <figcaption>Captured from <a href="#list-the-notes"><code>src/app.tsx</code></a> above.</figcaption>
</figure>
