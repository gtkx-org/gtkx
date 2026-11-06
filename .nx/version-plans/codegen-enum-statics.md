---
__default__: minor
---

Functions that GIR attaches to an enumeration, flags type or error domain are now also its statics, as in GJS, so `Gio.DBusError.getRemoteError(error)`, `Adw.AccentColor.toRgba(color)` and `Gio.DBusError.quark()` work alongside the namespace exports such as `Gio.dbusErrorGetRemoteError`. Generated documentation that links to these names now points at members that exist, and each enum's reference page lists its functions.
