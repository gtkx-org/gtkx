---
__default__: patch
---

`ListView`, `GridView`, `ColumnView`, `DropDown` and `ComboRow` keep rows mounted when items are inserted or moved, clear the selection when the selected item is removed, and no longer echo controlled `selectedIds` or `expandedIds` to their callbacks. Sectioned lists start at their first header and keep it when its first row is removed, and reordering columns keeps the sort. `DropDown` and `ComboRow` show a checkmark, ellipsize long items, support `useSubtitle` and `enableSearch`, and pass the full-list `index` while filtered.
