---
description: "Rename notes in a validating dialog and move them to the trash with an undo toast."
---

# Rename, Trash, and Undo

Rename the open note in a dialog that checks the new name, and move notes to the desktop trash with an Undo toast.

## Rename a note

A note menu joins the preview toggle at the end of the note's header bar. `src/components/note-menu.tsx` holds both buttons, and the menu's items run two new window actions, `win.rename-note` and `win.trash-note`:

<<< @/figures/tutorial/trash-and-toasts/src/components/note-menu.tsx [src/components/note-menu.tsx]

- The main menu's items act on the whole app. The note menu's act on the open note, which makes it what the [GNOME HIG](https://developer.gnome.org/hig/patterns/controls/menus.html#secondary-menus) calls a secondary menu. See [Menus](/v2/guide/actions#menus).
- `PreviewToggle` is the toggle button from [Add Menus and Shortcuts](/v2/tutorial/actions-menus-shortcuts#menus), moved out of `src/components/window.tsx` unchanged.

F2 renames the open note, and the shortcuts dialog lists the key:

<<< @/figures/tutorial/trash-and-toasts/src/app.tsx{11} [src/app.tsx]

<<< @/figures/tutorial/trash-and-toasts/src/components/shortcuts.tsx{23-26} [src/components/shortcuts.tsx]

Both actions need the open note's name and are disabled while no note is open. `useOpenNoteName` from [Select the open note](/v2/tutorial/the-note-editor#select-the-open-note) can't provide it: a hook reads navigation state only inside `NavigationContainer`, and the window that declares the actions sits outside it. `src/navigation.ts` gains functions that read the route through the container ref instead:

<<< @/figures/tutorial/trash-and-toasts/src/navigation.ts{22-39,47-54} [src/navigation.ts]

- `openNoteName` returns the open note's name, or `null` while the list shows or before the container is ready. See the container's [ref methods](https://reactnavigation.org/docs/navigation-container/#methods-on-the-ref).
- `closeNoteIfOpen` goes back to the list when the given note is open. [Move to the trash](#move-to-the-trash) uses it.

Reading the ref doesn't re-render anything, so the window keeps the name in state:

<<< @/figures/tutorial/trash-and-toasts/src/components/window.tsx{9,13,18,21,23-29,33-36,70-73,91-92,105,113-116,121} [src/components/window.tsx]

- [`onStateChange`](https://reactnavigation.org/docs/navigation-container/#onstatechange) runs after every navigation, and stores `openNoteName()` in `openName`. It doesn't run for the initial state, which is the list, so `openName` starts as `null`.
- `WindowActions` receives `openName`, so opening and closing a note enables and disables both actions, and their menu items with them.
- The note screen's `headerEnd` holds both buttons from `note-menu.tsx`.
- `NotesWindow` calls `useNoteCommands` for `renameNote` and passes it to the dialogs. [Undo from a toast](#undo-from-a-toast) shows the command.

Rename shows `RenameDialog`, an `AdwAlertDialog` with an entry for the new name:

<<< @/figures/tutorial/trash-and-toasts/src/components/rename-dialog.tsx [src/components/rename-dialog.tsx]

- `draft` holds the entry's text and starts as the current name. `onChanged` updates it on every keystroke.
- `canRename` enables the Rename response only for a name that is new, valid and not taken by another note. `isValidName` is in [Move to the trash](#move-to-the-trash).
- `defaultResponse` with the entry's `activatesDefault` makes Enter pick Rename, and `closeResponse` makes Escape pick Cancel. Either way `onResponse` runs and calls `onClose`, which unmounts the dialog. See [Dialogs](/v2/guide/modals-and-portals#dialogs).
- `SUGGESTED` gives Rename the accent color. [`AdwAlertDialog`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.AlertDialog.html) lists the other response appearances.

The `Dialog` union gains a `rename` kind that carries the note's name, and `Dialogs` renders `RenameDialog` for it:

<<< @/figures/tutorial/trash-and-toasts/src/components/dialogs.tsx{2,5-9,14,17,25-33} [src/components/dialogs.tsx]

## Move to the trash

`src/notes/files.ts` gains the file operations:

<<< @/figures/tutorial/trash-and-toasts/src/notes/files.ts{1,3-11,79-116,142,147-148} [src/notes/files.ts]

- Node's [`rename`](https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath) replaces a file that already has the new name, so `renameNote` checks for one first and fails instead. Unlike the `wx` flag in [Window actions](/v2/tutorial/actions-menus-shortcuts#window-actions), the check and the rename are separate steps: a file that another program creates between them is still replaced. Node has no rename that refuses to replace.
- `trashNote` moves the file to the desktop trash with [`Gio.File.trashAsync`](https://docs.gtk.org/gio/method.File.trash_async.html), so a mistaken trash can also be undone from the Trash in Files. GTKX turns GIO's async and finish pair into one method that returns a promise and rejects on failure. See [Async Operations](/v2/guide/async-operations).
- `isValidName` rejects an empty name, a name with whitespace at either end, a `/`, which would point into another folder, and a leading `.`, which hides the file from the note list.

The provider's `rename` and `trash` run these operations and update the list. The saver gains two methods for them:

<<< @/figures/tutorial/trash-and-toasts/src/notes/note-saver.ts{31-35,54-58} [src/notes/note-saver.ts]

<<< @/figures/tutorial/trash-and-toasts/src/notes/notes-provider.tsx{5-12,23-24,116-136,138} [src/notes/notes-provider.tsx]

- `settle` writes the note's pending save now and waits for it. Without it, a save still waiting out its delay from [Save and Watch Files](/v2/tutorial/saving-and-watching) would write the old name after the rename or trash and bring the file back.
- `forget` drops what the saver knows about the old name: the text it last wrote and whether its saves are failing. Otherwise a note restored from the Trash in Files would match that text, and the watcher would skip it as the app's own write.
- `rename` moves the note to its new key in the list and keeps its text and modification time.

## Undo from a toast

`useNoteCommands` gains the commands that the dialog and the actions run:

<<< @/figures/tutorial/trash-and-toasts/src/components/window-actions.tsx{5,13,24-42,45-47,52,59,65,74-91,113} [src/components/window-actions.tsx]

- `renameNote` opens the note under its new name once the file is renamed. A failure, such as a name another program took after the dialog checked it, shows in a toast.
- The `trashNote` command keeps the note's text, closes the note if it is open, so the editor can't save into a file that is gone, and moves the file to the trash.
- The toast that follows has an Undo button, the [GNOME HIG](https://developer.gnome.org/hig/patterns/feedback/toasts.html)'s common use for a toast after a destructive action. See [Toasts](/v2/guide/components#toasts).
- Undo writes the kept text back with `create` and opens the note. GIO doesn't say where in the trash the file went, so Undo makes a new file rather than restoring the old one, which stays in the trash. The new file has a new modification time, so the note returns at the top of the list. If another note took the name in the meantime, `create` picks the next free one, and `openNote` opens whichever name it used.
- `useMarkup: false` shows the note's name as plain text, as for the error toasts.

## Run it

Open a note and press F2. Rename stays disabled until the name is new, valid and unused, and Enter renames the note. Open the note menu and choose Move to Trash: the note leaves the list, the sidebar title counts one fewer note, and a toast offers Undo. Click Undo and the note comes back and opens.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-trash-and-toasts-light.png" width="720" height="480" loading="lazy" alt="The Notes window after Recipes was moved to the trash: the sidebar lists four notes, the content pane reads No Note Selected, and a toast at the bottom reads “Recipes” moved to Trash with an Undo button." />
    <img class="result-dark" src="/figures/tutorial-trash-and-toasts-dark.png" width="720" height="480" loading="lazy" alt="The Notes window after Recipes was moved to the trash: the sidebar lists four notes, the content pane reads No Note Selected, and a toast at the bottom reads “Recipes” moved to Trash with an Undo button." />
    <figcaption>Captured from <a href="#undo-from-a-toast"><code>src/components/window-actions.tsx</code></a> above, after Move to Trash on Recipes.</figcaption>
</figure>
