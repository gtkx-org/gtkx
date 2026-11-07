---
description: "Store the notes folder, color scheme and window size in GSettings and edit them in a preferences dialog."
---

# Add Preferences

Keep the notes folder, color scheme, preview state and window size in GSettings, and edit them in a preferences dialog.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## A settings schema

`data/dev.gtkx.Notes.gschema.xml` declares the keys, and a `GSettings` element opens them. See [Settings](/v2/guide/native-state#settings).

## Read and bind settings

`useSetting` reads the folder and color scheme; `useBindSetting` keeps the window size.

## The preferences dialog

A `win.preferences` action (Ctrl+,) in the main menu opens an `AdwPreferencesDialog` with a folder chooser built on `GtkFileDialog` and a `ComboRow` for the color scheme.

## Run it

What to check in the running app.
