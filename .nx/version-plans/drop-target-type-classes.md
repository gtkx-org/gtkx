---
__default__: patch
---

`<GtkDropTarget types>` accepts generated classes such as `Gdk.FileList` as well as GType values, like `Gtk.DropTarget.setGtypes`. Passing a class already worked at runtime but failed to typecheck.
