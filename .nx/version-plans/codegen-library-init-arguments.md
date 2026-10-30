---
__default__: minor
---

Importing a namespace now also calls its library's `init` function when the function takes only optional arguments, as `Gtk.init()`, `Adw.init()` and `GtkSource.init()` already were. GStreamer apps no longer need to call `Gst.init()` before loading plugin namespaces: importing `@gtkx/gi/gst` and `@gtkx/gi/gstpbutils` in any order works in `gtkx dev`, tests and builds, where loading `GstPbutils` first used to stop with a GLib critical from `gst_video_time_code_get_type`.
