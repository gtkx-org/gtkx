---
__default__: patch
---

`gtkx dev` restarts the app instead of failing when an edit changes a construct-only prop, remounts the component that renders `AdwApplication`, or touches a module that calls `registerClass`, and names the non-component export that forced a restart. It also restarts when the lockfile or a GIR file the bindings came from changes, and survives installs that move, upgrade or unlink the GTKX packages it runs from.
