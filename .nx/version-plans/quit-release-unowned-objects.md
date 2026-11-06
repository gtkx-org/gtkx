---
__default__: patch
---

When an app quits, GTKX now disposes the objects that only JavaScript still references while JavaScript still runs, widgets first, then instances of registered classes, then other objects, together with the objects they own. A column or list view over a JavaScript `Gio.ListModel` used to be torn down after JavaScript had stopped, so GTK read the model as empty and printed `Finalizing GtkColumnListView ..., but it still has children left` with a line per row whenever the window closed. The model's vfuncs now run during that teardown, and a registered class's `vfuncDispose` runs with its JavaScript state when its object is disposed at exit. Objects GTK itself still holds at exit, such as a window that was never destroyed, are not disposed, as in a C application.
