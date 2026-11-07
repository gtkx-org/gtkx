---
description: "Save edits with debounced writes and show changes other programs make to the notes folder."
---

# Save and Watch Files

Write edits back to their files without blocking typing, and show notes that another editor or a sync tool adds, changes or removes while the app runs.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Save edits

A `NoteSaver` debounces writes per note and runs them one at a time; the provider flushes pending saves when the folder closes.

<<< @/figures/tutorial/saving-and-watching/src/notes/note-saver.ts [src/notes/note-saver.ts]

`files.ts` gains `writeNote`, and `readNote` returns `null` for a file that no longer exists.

<<< @/figures/tutorial/saving-and-watching/src/notes/files.ts [src/notes/files.ts]

The editor reports each change to the buffer, and the note screen passes it to the provider's `edit`.

<<< @/figures/tutorial/saving-and-watching/src/editor/note-editor.tsx [src/editor/note-editor.tsx]

<<< @/figures/tutorial/saving-and-watching/src/components/note-screen.tsx [src/components/note-screen.tsx]

## Watch the folder

`fs.watch` reports files changed outside the app; the provider rereads them and ignores its own writes.

<<< @/figures/tutorial/saving-and-watching/src/notes/notes-provider.tsx [src/notes/notes-provider.tsx]

## Report a failed save

A toast from `@gtkx/components` names a note that could not be saved. See [Toasts](/v2/guide/components#toasts). The window shares an `AdwToastOverlay` through `ToastProvider`, outside `NotesProvider` so the provider can call `useToast`.

<<< @/figures/tutorial/saving-and-watching/src/app.tsx [src/app.tsx]

## Run it

Open a note and type: the file in the notes folder changes within half a second of the last keystroke. Add, change or delete a `.md` file in the folder from another program, and the list follows.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-saving-and-watching-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch open in the editor and a new note, Groceries, at the top of the sidebar list above the five earlier notes." />
    <img class="result-dark" src="/figures/tutorial-saving-and-watching-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch open in the editor and a new note, Groceries, at the top of the sidebar list above the five earlier notes." />
    <figcaption>Captured from <a href="#report-a-failed-save"><code>src/app.tsx</code></a> above, after opening Website relaunch and writing <code>Groceries.md</code> into the notes folder from outside the app.</figcaption>
</figure>
