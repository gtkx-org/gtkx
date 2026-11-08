---
__default__: minor
---

Generated bindings gain more of GJS's API. Functions GIR attaches to an enumeration or error domain are its statics (`Gio.DBusError.getRemoteError`), functions moved onto a class keep their flat name (`GLib.sourceRemove`), and enumerations carry their GType as `__type__`. `new` on a boxed record calls its `new` constructor (`new GLib.VariantType("s")`), embedded record fields read as views into their parent, and every `Gio.ActionMap` has `addActionEntries`. Importing a namespace calls its library's `init` when it takes only optional arguments, so GStreamer apps no longer need `Gst.init()`.
