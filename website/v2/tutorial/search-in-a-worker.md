---
description: "Index notes with MiniSearch in a Node worker thread and search them from the sidebar."
---

# Search in a Worker

Index the full text of every note with MiniSearch in a worker thread, so searching never blocks the window.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Build the index in a worker

Install `minisearch`. The worker holds a MiniSearch index of each note's name and text, applies the changes it is sent and answers queries with matching note names. Names weigh twice as much as text, and a query matches word prefixes and near misses. See [Workers and Helper Processes](/v2/guide/workers) for how `gtkx dev`, Vitest and `gtkx build` load the worker file.

<<< @/figures/tutorial/search-in-a-worker/src/search/search-worker.ts [src/search/search-worker.ts]

`SearchIndex` starts the worker on first use, sends it only the notes that changed since the last update, and resolves each query when its answer comes back.

<<< @/figures/tutorial/search-in-a-worker/src/search/search-index.ts [src/search/search-index.ts]

## Query from React

`useNoteSearch` keeps one `SearchIndex` for the screen's lifetime, updates it when the notes change, and returns the matching note names, or `null` while the query is empty. An answer that arrives after the query changed is dropped.

<<< @/figures/tutorial/search-in-a-worker/src/search/use-note-search.ts [src/search/use-note-search.ts]

## The search entry

A `GtkSearchEntry` above the list filters it as you type. Escape clears it, and a status page shows when nothing matches.

<<< @/figures/tutorial/search-in-a-worker/src/components/notes-screen.tsx{68-72,89-91,98-117} [src/components/notes-screen.tsx]

## Focus search with Ctrl+F

`FocusShortcut` in the file above is a `GtkShortcutController` with global scope on the sidebar, so Ctrl+F focuses the entry from anywhere in the window. See [Shortcuts without an action](/v2/guide/actions#shortcuts-without-an-action).

## Run it

Type "kickoff" in the search entry. The list narrows to the two notes whose text mentions it, Website relaunch and Meeting notes. Type something no note contains to see the status page, then press Escape to clear the search.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-search-in-a-worker-light.png" width="720" height="480" loading="lazy" alt="The Notes window with kickoff typed in the search entry above the sidebar, which lists only Website relaunch and Meeting notes." />
    <img class="result-dark" src="/figures/tutorial-search-in-a-worker-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with kickoff typed in the search entry above the sidebar, which lists only Website relaunch and Meeting notes." />
    <figcaption>Captured from <a href="#the-search-entry"><code>src/components/notes-screen.tsx</code></a> above, after typing kickoff in the search entry.</figcaption>
</figure>
