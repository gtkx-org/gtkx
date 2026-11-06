---
__default__: patch
---

`userEvent.click`, `dblClick`, `tripleClick` and `pointer` on a `GtkListView`, `GtkGridView` or `GtkColumnView` row now honour modifiers held through `userEvent.keyboard`, as a pointer click does: Control toggles the row in a multiple selection and Shift extends the selection to it. They used to replace the selection whatever was held.
