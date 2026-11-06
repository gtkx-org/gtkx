---
__default__: patch
---

The generated interface `Impl` types and the Subclassing guide now say to leave out `implements` on a class that fills none of the interface's slots, such as a `Gtk.Scrollable` widget that only overrides the adjustment properties, which TypeScript otherwise rejects with "has no properties in common".
