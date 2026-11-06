---
__default__: patch
---

Reordering or inserting the columns of a `GtkColumnView`, or of a `ColumnView` from `@gtkx/components`, now moves them in place and keeps the current sort. GTKX used to remove and re-add every column after the moved or inserted one, which cleared the sort when the sorted column was among them, so a controlled `ColumnView` reported `onSortChanged(null)` although nobody had touched a header.
