---
__default__: patch
---

A sectioned `ListView` or `ColumnView` taller than its viewport, and the popup of a sectioned `DropDown` or `ComboRow`, now start at their first section header. GTK anchored these lists at their first row when their items arrived after the widget was created, which `@gtkx/components` always does, so the first header sat just above the visible area and popups opened part-way down their list.
