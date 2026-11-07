---
description: "Open notes in a GtkSourceView editor with Markdown highlighting, inside a split view."
---

# Edit a Note

Generate bindings for GtkSourceView, a library outside the default set, and open the selected note in a Markdown editor beside the list.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Add GtkSourceView

`libraries: ["GtkSource-5"]` in `gtkx.config.ts` generates `@gtkx/gi/gtksource` and `@gtkx/jsx/gtksource`. See [The config file](/v2/guide/configuration-and-codegen#the-config-file).

## Two screens in a split view

`createSplitViewNavigator` from `@gtkx/navigation` puts the note list in the sidebar and the open note in the content pane, with a placeholder when no note is open. See [Split view navigator](/v2/guide/navigation#split-view-navigator).

## Select the open note

The list's selection follows the current route, so the highlighted row always matches the open note.

## The editor

`GtkSourceView` with a Markdown `GtkSourceBuffer`; `useProperty` follows the dark style to pick the Adwaita or Adwaita-dark scheme. See [Following a property](/v2/guide/native-state#following-a-property).

## Run it

What to check in the running app.
