---
description: "Rename notes in a validating dialog and move them to the trash with an undo toast."
---

# Rename, Trash, and Undo

Rename notes in a dialog that validates the new name, and move notes to the desktop trash with an Undo toast.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Rename a note

A note menu in the note header runs new `win.rename-note` (F2) and `win.trash-note` actions. Rename opens an `AdwAlertDialog` with a controlled entry; its Rename response stays disabled for an unchanged, empty, hidden or taken name.

## Move to the trash

`Gio.File.trashAsync` moves the file to the desktop trash instead of deleting it.

## Undo from a toast

The toast's Undo button writes the note back with its text and opens it. See [Toasts](/v2/guide/components#toasts).

## Run it

What to check in the running app.
