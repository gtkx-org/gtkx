---
__default__: patch
---

`ListView`, `GridView` and `ListItemFactory` accept `rowProps`, as `ColumnView` already did, so each row can carry an accessible label and description and be made unselectable, unactivatable or unfocusable. GTK names a list row only from its own accessible label, so rows of these views had no name a screen reader could announce.
