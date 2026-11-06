---
__default__: patch
---

Collapsing many tree rows at once through `expandedIds`, such as clearing a search that expanded every matching folder, is several times faster in `ListView` and `ColumnView`. Rows now collapse from the last one up, so GTK no longer shifts every row still waiting to collapse.
