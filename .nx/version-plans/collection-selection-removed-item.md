---
__default__: patch
---

`ListView`, `GridView` and `ColumnView` no longer select the row that takes the place of a removed item. When the item named by `selectedIds` left the collection, or moved under a collapsed tree row, the row that took its position stayed highlighted and `onSelectionChanged` reported it as selected, so an app that opens the selected item opened one the user never chose. The selection now clears and `onSelectionChanged` reports an empty list.
