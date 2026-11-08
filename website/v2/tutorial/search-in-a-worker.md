---
description: "Index notes with MiniSearch in a Node worker thread and search them from the sidebar."
---

# Search in a Worker

Index the full text of every note with MiniSearch in a worker thread, so searching never blocks the window.

## Build the index in a worker

Your JavaScript runs on the same thread as GTK's main loop, so while it computes, the window can't redraw or take input. Indexing a few notes takes no time, but a folder of several thousand would freeze the window each time the index is rebuilt. [MiniSearch](https://lucaong.github.io/minisearch/) builds a full-text index in memory, and a [Node worker thread](https://nodejs.org/api/worker_threads.html) runs it beside the main thread. Install it; it ships its own types:

```sh
npm install minisearch
```

The worker, in a new file `src/search/search-worker.ts`, holds the index and answers messages from the main thread:

<<< @/figures/tutorial/search-in-a-worker/src/search/search-worker.ts [src/search/search-worker.ts]

- An `update` message carries the notes that changed and the names of those that were removed. MiniSearch rejects a second document with the same ID, so the worker first drops the old version of each note with `discard`, which needs only the ID, and then adds the new ones.
- A `search` message carries an `id`, and the answer sends it back with the matching note names, so the main thread can tell which query an answer belongs to.
- `idField: "name"` makes the note name the document ID; names are unique because they are file names. `prefix: true` lets "kick" find "kickoff", and `fuzzy: 0.2` allows an edit distance of a fifth of each word's length, rounded, so "kikoff" finds it too. See MiniSearch's [search options](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html).
- `parentPort` is `null` outside a worker, so importing the file on the main thread by mistake fails at once.

A worker can't use GTK, since only the main thread owns GTKX's GLib integration; this one needs only MiniSearch and Node. [Workers and Helper Processes](/v2/guide/workers) explains how `gtkx dev`, Vitest and `gtkx build` load a worker file and which syntax it can use.

## Talk to the worker

`SearchIndex`, in `src/search/search-index.ts`, is the main thread's side of the conversation:

<<< @/figures/tutorial/search-in-a-worker/src/search/search-index.ts [src/search/search-index.ts]

- The worker starts on the first message, so nothing runs until there are notes to index.
- `#indexed` keeps the text last sent for each note, and `update` sends only the notes whose text differs and the names that disappeared. After a save, the worker re-indexes one note rather than the folder.
- `search` gives each query an ID and returns a promise that the answer with that ID resolves. The worker handles messages in the order they were sent, so a query always sees the update sent before it.
- `close` stops the worker and forgets what it was sent, so a later `update` starts a new worker and sends every note.

`search-index.ts` imports the message types with `import type`, which is removed when the file is compiled, so the main thread never loads the worker's module. `gtkx build` bundles the worker because `new Worker` names its source file directly. During `gtkx dev`, an edit to `search-worker.ts` restarts the app instead of refreshing it, since [Fast Refresh](/v2/tutorial/fast-refresh) only reaches the main thread.

## Query from React

`useNoteSearch`, in `src/search/use-note-search.ts`, connects the index to the screen:

<<< @/figures/tutorial/search-in-a-worker/src/search/use-note-search.ts [src/search/use-note-search.ts]

The `useState` initializer creates one `SearchIndex` when the screen mounts, and the first effect closes it when the screen unmounts. The second effect runs whenever the notes or the query change: it updates the index, which sends nothing when no note changed, and searches if the query isn't empty. When the query changes before an answer arrives, the effect's cleanup sets `current` to `false`, so the late answer doesn't replace a newer one. The hook returns the set of matching names, or `null` while the query is empty, which means "show every note".

## The search entry

`src/components/notes-screen.tsx` puts a `GtkSearchEntry` above the list:

<<< @/figures/tutorial/search-in-a-worker/src/components/notes-screen.tsx{6-15,17,21,46-61,68-72,89-91,94-108,110-143} [src/components/notes-screen.tsx]

- The entry emits [`search-changed`](https://docs.gtk.org/gtk4/signal.SearchEntry.search-changed.html) once typing pauses for 150 milliseconds rather than on every key, so `query` and the worker see one query per pause. `onSearchChanged` stores the entry's text, trimmed before it reaches the hook.
- Escape emits [`stop-search`](https://docs.gtk.org/gtk4/signal.SearchEntry.stop-search.html), and `onStopSearch` empties the query. The `text` prop then clears the entry; GTKX writes it only when it differs from the entry's text, so typing never fights it ([The JSX prop model](/v2/guide/jsx-elements#the-jsx-prop-model)).
- `accessibleLabel` names the entry for screen readers and for tests, which find it by that name in [Test the App](/v2/tutorial/testing).
- The list keeps only the notes in the matches, still newest first, and a status page replaces it when none match.

## Focus search with Ctrl+F

`FocusShortcut` at the top of the file is a `GtkShortcutController` in the sidebar box's `controllers` prop. Its `GLOBAL` scope handles Ctrl+F anywhere in the window, not only while the sidebar has focus. The callback needs the entry widget, so the entry's `ref` stores it in state (`setSearchEntry`), and the screen renders again with it once the entry exists. The callback returns whether `grabFocus` succeeded; `false`, before the entry exists or when it can't take focus, leaves the key to other handlers. See [Shortcuts without an action](/v2/guide/actions#shortcuts-without-an-action).

## Run it

Type "kickoff" in the search entry. The list narrows to the two notes whose text mentions it, Website relaunch and Meeting notes. Type something no note contains to see the status page, then press Escape to clear the search.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-search-in-a-worker-light.png" width="720" height="480" loading="lazy" alt="The Notes window with kickoff typed in the search entry above the sidebar, which lists only Website relaunch and Meeting notes." />
    <img class="result-dark" src="/figures/tutorial-search-in-a-worker-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with kickoff typed in the search entry above the sidebar, which lists only Website relaunch and Meeting notes." />
    <figcaption>Captured from <a href="#the-search-entry"><code>src/components/notes-screen.tsx</code></a> above, after typing kickoff in the search entry.</figcaption>
</figure>
