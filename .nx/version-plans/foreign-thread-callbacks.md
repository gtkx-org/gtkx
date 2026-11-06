---
__default__: patch
---

A JavaScript signal handler, callback or virtual function override that a library calls from another thread, such as a `playbin3` `about-to-finish` handler on a GStreamer streaming thread, is now skipped with a GLib warning that names the signal and the emitting object, as GJS does, and the application keeps running. It used to panic in the native addon and end the application.
