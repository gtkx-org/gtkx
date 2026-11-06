---
__default__: patch
---

Applications register one GTKX type directly below their class, so the GTK Inspector and GLib messages name an `Adw.Application` `GtkxAdwApplication` instead of `GtkxGtkxGtkxAdwApplication`, and its lifecycle overrides run once per call.
