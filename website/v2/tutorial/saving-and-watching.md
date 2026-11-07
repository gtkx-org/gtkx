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

## Watch the folder

`fs.watch` reports files changed outside the app; the provider rereads them and ignores its own writes.

## Report a failed save

A toast from `@gtkx/components` names a note that could not be saved. See [Toasts](/v2/guide/components#toasts).

## Run it

What to check in the running app.
