---
description: "Create notes and open dialogs from menus and keyboard shortcuts with GIO actions."
---

# Add Menus and Shortcuts

Declare the app's commands as GIO actions, then reach them from header bar menus, buttons and keyboard shortcuts.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Window actions

The window's `actions` prop declares New Note, Rename, Move to Trash, the preview toggle and the dialog actions. See [Declaring actions](/v2/guide/actions#declaring-actions).

## Menus

The main menu and the note menu in the split view headers. See [Menus](/v2/guide/actions#menus).

## Keyboard shortcuts

`actionAccels` on the application, `app.quit`, and the shortcuts dialog. See [Keyboard accelerators](/v2/guide/actions#keyboard-accelerators).

## Mount the dialogs

One `Dialogs` component shows the About, Keyboard Shortcuts and Rename dialogs from window state. See [Dialogs](/v2/guide/modals-and-portals#dialogs).

## Run it

What to check in the running app.
