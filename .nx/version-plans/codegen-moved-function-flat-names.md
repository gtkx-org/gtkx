---
__default__: patch
---

Functions that GIR moves onto a class, interface or record are now also exported from their namespace under their flat name, as in GJS, so `GLib.sourceRemove(id)` works alongside `GLib.Source.remove(id)` and GJS ports compile unchanged.
