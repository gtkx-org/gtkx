---
__default__: patch
---

`ListView`, `GridView` and `ColumnView` no longer report `selectedIds` and `expandedIds` changes back through `onSelectionChanged` and `onExpandedChange`, and no longer call them on mount. Echoing the prop let a list loop against state that catches up a commit late, as with React Navigation params, until React stopped with "Maximum update depth exceeded". The callbacks now report what the user or the widget changes, and still report the remaining ids when an item the prop names is gone.
