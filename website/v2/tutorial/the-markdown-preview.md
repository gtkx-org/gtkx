---
description: "Parse Markdown with an npm package and render the syntax tree as native GTK widgets."
---

# Render the Preview

Parse each note with `mdast-util-from-markdown` and render its syntax tree as GTK widgets, so the preview is native text that follows the system style.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Parse Markdown

Install `mdast-util-from-markdown` and `@types/mdast`; `fromMarkdown` turns a note into an [mdast](https://github.com/syntax-tree/mdast) syntax tree.

## Map nodes to widgets

`MarkdownPreview` renders headings, paragraphs, lists, block quotes, code and rules as GTK widgets, and inline formatting as Pango markup. It follows CommonMark: tables, strikethrough and task lists stay as text.

## Switch between editor and preview

A `GtkStack` crossfades between the editor and the preview.

## Follow links

Links to other notes open them in the app; other links open in the default browser.

## Run it

What to check in the running app.
