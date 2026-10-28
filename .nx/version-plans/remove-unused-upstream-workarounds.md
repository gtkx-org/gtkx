---
__default__: patch
---

Remove upstream-defect workarounds that no GTKX code or test reaches. Generated bindings now follow the installed GIR metadata for the affected GLib, Gio, Gtk, HarfBuzz and Pango functions, so a few getters are typed non-null where GLib can return null, and `Pango.AttrIterator` exposes `destroy()`. `Gtk.Window` no longer keeps its default widget alive, `Adw.Sidebar` no longer disposes rows retired by a mode change, and `ImageSurface.getData()` no longer rejects a finished surface. `create-gtkx` lets Citty resolve repeated boolean flags.
