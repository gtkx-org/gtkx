---
__default__: patch
---

Generated bindings follow GIR and GJS more closely: nullable zero-terminated arrays return `null`, so `readLine` loops end, methods from typelib-generated GIR files receive their instance, and `GObject.signalEmitv` takes values. Reference-counted boxed callback arguments stay usable after the handler returns, `Gio.Settings` throws instead of aborting on a missing schema or key, and callbacks from other threads are skipped with a warning instead of crashing. `Gtk.Editable` delegates and interface property accessors take effect in registered classes.
