---
__default__: patch
---

Removing a subtree that holds the keyboard focus no longer makes GTK warn `Error finding last focus widget of GtkPaned`, for example when an editor in a `GtkPaned` closes while its text view is focused. Before detaching the subtree, GTKX moves the focus where GTK would after the removal: to the nearest visible ancestor that takes it, else to the window's first focusable widget outside the subtree, or nowhere when the whole window goes.
