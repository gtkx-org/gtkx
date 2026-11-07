---
description: "Read Markdown files from a folder with Node's file APIs and list them in a GTK list view."
---

# List the Notes

Read the `.md` files in the notes folder with Node's `fs/promises` and list them, newest first, in a GTK list view. Each note is a plain file, so any editor or sync tool can change it.

## Find the notes folder

Notes keeps its files in a `Notes` folder inside the user's Documents folder:

<<< @/figures/tutorial/the-notes-folder/src/notes/files.ts [src/notes/files.ts]

[`GLib.getUserSpecialDir`](https://docs.gtk.org/glib/func.get_user_special_dir.html) returns the Documents folder set in `user-dirs.dirs`, which the desktop may have localized or moved, or `null` when there is none; Notes then uses the home folder. `@gtkx/gi/glib` holds the GLib bindings, generated like the elements in `@gtkx/jsx`.

The rest is Node.js, which owns the process while GLib runs inside it. `readNotes` creates the folder on first launch, keeps the visible `.md` files, and reads each file's text and modification time in parallel. A folder named `something.md` fails `isFile()` and is skipped.

## Read the notes

A `Note` is the file's name without `.md`, its text, its modification time in milliseconds, and an excerpt for the list:

<<< @/figures/tutorial/the-notes-folder/src/notes/note.ts [src/notes/note.ts]

The excerpt is the first line that is neither empty nor a heading, as written, so Markdown such as `**bold**` shows its asterisks. [Render the Preview](/v2/tutorial/the-markdown-preview) parses the Markdown and takes the excerpt from the parsed text instead.

## Share the notes

The list, and later the editor and search, need the same notes. A context provider loads them once for a folder:

<<< @/figures/tutorial/the-notes-folder/src/notes/notes-provider.tsx [src/notes/notes-provider.tsx]

`notes` is `null` until the folder has loaded, then a map from each note's name to the note. The effect aborts on cleanup, so a read that finishes after the provider unmounts, or after `folder` changes, sets no state. `useNotes` reads the context with React's [`use`](https://react.dev/reference/react/use) and throws outside the provider.

## List the notes

Install `@gtkx/components`, which renders GTK's list widgets from data:

```bash
npm install @gtkx/components@beta
```

The notes screen shows a spinner while the folder loads, the empty state from [Create a Window](/v2/tutorial/your-first-window) when it has no notes, and otherwise a list of every note, newest first:

<<< @/figures/tutorial/the-notes-folder/src/components/notes-screen.tsx [src/components/notes-screen.tsx]

- `ListView` takes `items` as `{ id, value }` pairs and a `renderItem` for each row. The note's name is its ID, which is unique within a folder. [List components](/v2/guide/components#list-components) covers selection and how IDs keep rows' state.
- `isFlat` says no item has children, so the list skips looking for a tree.
- GTK names a list row from its own accessible label, not from its content, so `rowProps` labels each row with the note's name. Screen readers announce it, and [Test the App](/v2/tutorial/testing) finds rows by it.
- The `navigation-sidebar` style class gives the rows Adwaita's sidebar look, and the `heading`, `dimmed` and `caption` classes style the labels; see [Style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html). Both labels end in an ellipsis when the window is too narrow, and the scrolled window never scrolls sideways.

The app wraps the toolbar view in the provider and shows the screen in place of the status page:

<<< @/figures/tutorial/the-notes-folder/src/app.tsx{9-11,24-28} [src/app.tsx]

## Run it

Save the files. The app restarts, creates the notes folder if it is missing, and shows the empty state. Add a few `.md` files to the folder, `~/Documents/Notes` on most desktops, then close the window and run `npm run dev` again: the app reads the folder only when it starts until [Save and Watch Files](/v2/tutorial/saving-and-watching) watches it. The window lists the notes, newest first.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-notes-folder-light.png" width="360" height="294" loading="lazy" alt="The Notes window listing five notes, newest first: Website relaunch, Meeting notes, Trip to Lisbon, Book club and Recipes, each name above its first line of text in dimmed type." />
    <img class="result-dark" src="/figures/tutorial-the-notes-folder-dark.png" width="360" height="294" loading="lazy" alt="The Notes window listing five notes, newest first: Website relaunch, Meeting notes, Trip to Lisbon, Book club and Recipes, each name above its first line of text in dimmed type." />
    <figcaption>Captured from <a href="#list-the-notes"><code>src/app.tsx</code></a> above.</figcaption>
</figure>
