---
__default__: patch
---

A registered class that implements an interface and defines its own getter and setter for one of the interface's properties, such as `orientation` for `Gtk.Orientable`, now answers native reads and writes of that property through those accessors. Native code used to read and write a separate stored value, so `GObject.getProperty` and GTK itself saw a different value from the one the class's accessors reported.
