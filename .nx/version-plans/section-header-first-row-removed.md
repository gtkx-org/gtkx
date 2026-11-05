---
__default__: patch
---

A `ListView`, `ColumnView`, `DropDown` or `ComboRow` section keeps its `renderHeader` header when the section's first row is removed. Removing that row, such as deleting the newest message under a "Yesterday" header, used to leave the header empty until the section was rebuilt, because GTK keeps the removed row as the header's item.
