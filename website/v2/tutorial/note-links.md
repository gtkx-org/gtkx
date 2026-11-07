---
description: "Implement a GtkSourceView completion provider in TypeScript to suggest links to other notes."
---

# Complete Note Links

Implement the `GtkSource.CompletionProvider` interface in a TypeScript class that suggests links to other notes as you type.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Implement a GObject interface

`NoteLinkProvider` registers a GObject class that implements `GtkSource.CompletionProvider`. See [Implementing an interface](/v2/guide/subclassing#implementing-an-interface).

## Offer note names

Typing `[[` offers the other notes' names, and choosing one inserts a Markdown link to that note.

## Attach it to the editor

The editor adds the provider to its completion and keeps the list of note names current.

## Run it

What to check in the running app.
