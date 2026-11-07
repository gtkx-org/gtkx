---
description: "Rename notes in a validating dialog and move them to the trash with an undo toast."
---

# Rename, Trash, and Undo

Rename notes in a dialog that validates the new name, and move notes to the desktop trash with an Undo toast.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Rename a note

A note menu joins the preview toggle in the note header. Its items run new `win.rename-note` (F2) and `win.trash-note` actions. See [Menus](/v2/guide/actions#menus).

<<< @/figures/tutorial/trash-and-toasts/src/components/note-menu.tsx [src/components/note-menu.tsx]

<<< @/figures/tutorial/trash-and-toasts/src/app.tsx{11} [src/app.tsx]

<<< @/figures/tutorial/trash-and-toasts/src/components/shortcuts.tsx{24-27} [src/components/shortcuts.tsx]

Both actions apply to the open note and are disabled while none is open. The window sits outside the navigator, so it can't read the route with a hook: `NavigationContainer`'s `onStateChange` reads the open note's name through the container ref and keeps it in `openName`. See React Navigation's [container API](https://reactnavigation.org/docs/navigation-container/).

<<< @/figures/tutorial/trash-and-toasts/src/navigation.ts{26-38,48,51} [src/navigation.ts]

<<< @/figures/tutorial/trash-and-toasts/src/components/window.tsx{13,18,21,25,28,33-36,70-73,91-92,105,115,121} [src/components/window.tsx]

Rename opens an `AdwAlertDialog` with a controlled entry. Its Rename response stays disabled for an unchanged, empty, hidden or taken name, or one with surrounding spaces or a slash. See [Dialogs](/v2/guide/modals-and-portals#dialogs).

<<< @/figures/tutorial/trash-and-toasts/src/components/rename-dialog.tsx [src/components/rename-dialog.tsx]

<<< @/figures/tutorial/trash-and-toasts/src/components/dialogs.tsx{2,9,14,17,25-33} [src/components/dialogs.tsx]

## Move to the trash

`renameNote` refuses a name that is already taken, because a rename would replace that file. `trashNote` moves the file to the desktop trash with [`Gio.File.trashAsync`](https://docs.gtk.org/gio/method.File.trash_async.html) instead of deleting it.

<<< @/figures/tutorial/trash-and-toasts/src/notes/files.ts{1,4,8,79-115,142,147-148} [src/notes/files.ts]

The provider's `rename` and `trash` first settle the note's pending save, so a delayed write can't recreate the old file, then forget the saver's record of it.

<<< @/figures/tutorial/trash-and-toasts/src/notes/note-saver.ts{31-34,54-57} [src/notes/note-saver.ts]

<<< @/figures/tutorial/trash-and-toasts/src/notes/notes-provider.tsx{10-11,23-24,116-135,138} [src/notes/notes-provider.tsx]

## Undo from a toast

Trash closes the note if it is open, moves it to the trash and shows a toast. The toast's Undo button writes the note back with its text and opens it. Rename opens the note under its new name. See [Toasts](/v2/guide/components#toasts).

<<< @/figures/tutorial/trash-and-toasts/src/components/window-actions.tsx{5,13,24-47,52,59,65,74-91,113} [src/components/window-actions.tsx]

## Run it

Open a note and press F2. The Rename button stays disabled until the name is new and valid. Open the note menu and choose Move to Trash: the note leaves the list, the sidebar title counts one fewer note, and a toast offers Undo. Click Undo and the note comes back and opens.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-trash-and-toasts-light.png" width="720" height="480" loading="lazy" alt="The Notes window after Recipes was moved to the trash: the sidebar lists four notes, the content pane reads No Note Selected, and a toast at the bottom reads “Recipes” moved to Trash with an Undo button." />
    <img class="result-dark" src="/figures/tutorial-trash-and-toasts-dark.png" width="720" height="480" loading="lazy" alt="The Notes window after Recipes was moved to the trash: the sidebar lists four notes, the content pane reads No Note Selected, and a toast at the bottom reads “Recipes” moved to Trash with an Undo button." />
    <figcaption>Captured from <a href="#undo-from-a-toast"><code>src/components/window-actions.tsx</code></a> above, after Move to Trash on Recipes.</figcaption>
</figure>
