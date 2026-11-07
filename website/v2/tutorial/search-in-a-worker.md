---
description: "Index notes with MiniSearch in a Node worker thread and search them from the sidebar."
---

# Search in a Worker

Index the full text of every note with MiniSearch in a worker thread, so searching never blocks the window.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Build the index in a worker

Install `minisearch`; a `node:worker_threads` worker holds the index, and the window sends it note changes and queries. See [Workers and Helper Processes](/v2/guide/workers).

## Query from React

`useNoteSearch` sends the query and returns the matching note names.

## The search entry

A `GtkSearchEntry` above the list filters it as you type, Escape clears it, and a status page shows when nothing matches.

## Focus search with Ctrl+F

A `GtkShortcutController` with global scope focuses the entry.

## Run it

What to check in the running app.
