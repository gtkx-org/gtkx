---
__default__: patch
---

`error.matches(domain, code)` and `new GLib.Error(domain, code, message)` now typecheck with every error domain, including those that carry functions such as `Gio.ResolverError`, `Gio.DBusError` and `Gtk.DialogError`.
