---
__default__: patch
---

Generated reference pages now list constructors separately and show the class they return, as the declarations do: `Gtk.Overlay.new()` returns `Gtk.Overlay`, not `Gtk.Widget`. Floating-point defaults read as JavaScript numbers (`0.5`, `1.7976931348623157e+308`) instead of C's `%f` output.
