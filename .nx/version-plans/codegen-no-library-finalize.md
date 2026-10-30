---
__default__: patch
---

GTKX no longer calls `GtkSource.finalize()` when an app quits. Importing a namespace still runs its library's `init` function, and the process releases the libraries when it exits, as in GJS and most C apps.
