---
description: "Save edits with debounced writes and show changes other programs make to the notes folder."
---

# Save and Watch Files

Write edits back to their files without blocking typing, and show notes that another editor or a sync tool adds, changes or removes while the app runs.

## Save edits

Writing the file on every keystroke would save once per character, and two writes of the same file could finish out of order. A `NoteSaver`, in a new file `src/notes/note-saver.ts`, waits until typing pauses, then writes the note's newest text:

<<< @/figures/tutorial/saving-and-watching/src/notes/note-saver.ts [src/notes/note-saver.ts]

- `schedule` restarts the note's timer with the new text, so a burst of typing becomes one write, 400 milliseconds after the last change.
- `#flush` queues each write behind the note's previous one, so saves of one note never overlap and the last text wins. Different notes save independently.
- `#written` records the text of each note's latest write as soon as the write is queued, and `isPending` tells whether a note's text is still waiting for typing to pause. The folder watcher below uses both.
- A failed write calls `onError` once. The saver stays quiet about that note until one of its saves succeeds, so a full disk doesn't report every keystroke.
- `flushAll` starts every waiting write at once, for when the provider stops watching the folder.

`files.ts` gains `writeNote`, and `readNote` returns `null` for a file that no longer exists, which is how the watcher learns that a note was deleted:

<<< @/figures/tutorial/saving-and-watching/src/notes/files.ts{2,20-25,27-40,56-59} [src/notes/files.ts]

The editor reports each change to its buffer:

<<< @/figures/tutorial/saving-and-watching/src/editor/note-editor.tsx{11-13,34-42} [src/editor/note-editor.tsx]

`onChanged` handles the buffer's [`changed`](https://docs.gtk.org/gtk4/signal.TextBuffer.changed.html) signal, and `getText` reads the buffer from its start to its end. The `text` prop still fills the buffer: GTKX writes it only when it differs from the buffer's text, so typing never resets the cursor, and writing it doesn't call `onChanged`; see [The JSX prop model](/v2/guide/jsx-elements#the-jsx-prop-model).

The note screen passes each change to the provider's `edit`:

<<< @/figures/tutorial/saving-and-watching/src/components/note-screen.tsx{10,23-29} [src/components/note-screen.tsx]

## Watch the folder

The provider owns the saver, edits the notes in memory, and watches the folder for changes made by other programs:

<<< @/figures/tutorial/saving-and-watching/src/notes/notes-provider.tsx{1-3,5-7,14,19-33,42-52,56-66,70-76,83-94,96-98} [src/notes/notes-provider.tsx]

- `edit` schedules the save and updates the note at once, with the current time as its modification time. The list shows the new excerpt, and the edited note moves to the top.
- `useState` with an initializer creates one saver when the provider mounts and keeps it across renders.
- [`fs.watch`](https://nodejs.org/api/fs.html#fswatchfilename-options-listener) calls its listener with the name of each file that changes in the folder. The listener ignores the kind of event and rereads the file: a note that now exists is added or replaced, and one that doesn't is removed. `noteName` skips everything but visible `.md` files, such as the hidden temporary files some editors save through. Node doesn't promise a file name on every event ([Filename argument](https://nodejs.org/api/fs.html#filename-argument)), so the listener skips a `null` one.
- `refresh` leaves a note alone while it has a pending save, because the editor's text is newer than the file, and when the file holds the text the app last wrote, because the event reports the app's own save. Any other change came from another program, and the open editor shows it.
- The watcher takes the effect's abort signal, so the cleanup closes it, and a read that finishes afterwards sets no state. The cleanup also flushes pending saves. When the window closes, the app writes the last edits, and the Node process exits once they finish; an open watcher would keep it running. See [Ending work on unmount](/v2/guide/application-lifecycle#ending-work-on-unmount).

## Report a failed save

A toast from `@gtkx/components` names a note that couldn't be saved; [Toasts](/v2/guide/components#toasts) covers the provider and `useToast`. The window shares an `AdwToastOverlay` through `ToastProvider`, outside `NotesProvider` so the provider can call `useToast`. The overlay wraps the navigator, so the toast shows over both panes:

<<< @/figures/tutorial/saving-and-watching/src/app.tsx{1-2,8,12,21,33-61} [src/app.tsx]

In the provider's `onError`:

- `timeout: 0` keeps the toast until the user dismisses it ([`timeout`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/property.Toast.timeout.html)), so the message isn't missed while typing.
- `useMarkup: false` shows the title as written. Adwaita reads toast titles as Pango markup by default, and a note's name can contain `&` or `<`.
- The saver keeps the callback it was created with, so the message uses `t` imported from `@gtkx/i18n`, which translates into the current language whenever it runs, rather than the `t` of one render. <span v-pre>`{{name}}`</span> inserts the note's name; see [Internationalization](/v2/guide/internationalization).

## Run it

Save the files. The new imports restart the app. Open a note and type: about half a second after the last keystroke, its file in the notes folder holds the new text, and the note moves to the top of the list.

Add, change or delete a `.md` file in the folder from another program, and the list follows. Changing the open note's file updates the editor, and deleting it shows Note Not Found.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-saving-and-watching-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch open in the editor and a new note, Groceries, at the top of the sidebar list above the five earlier notes." />
    <img class="result-dark" src="/figures/tutorial-saving-and-watching-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch open in the editor and a new note, Groceries, at the top of the sidebar list above the five earlier notes." />
    <figcaption>Captured from <a href="#report-a-failed-save"><code>src/app.tsx</code></a> above, after opening Website relaunch and writing <code>Groceries.md</code> into the notes folder from outside the app.</figcaption>
</figure>
