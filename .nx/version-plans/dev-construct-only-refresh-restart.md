---
__default__: patch
---

Saving an edit that changes a construct-only prop, such as the `strings` of a `GtkStringList` or the `constant` of a `GtkConstraint`, now restarts the app in `gtkx dev`. Fast Refresh used to stop the app with "Cannot change the construct-only prop" and wait for another save.
