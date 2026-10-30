---
__default__: patch
---

`ListView`, `GridView`, `ColumnView`, `DropDown` and `ComboRow` keep rows mounted when items are inserted, removed or moved around them. Inserting an item at the top used to remount every row below it, resetting row state such as springs, `useState` and uncontrolled entries; now only the new row mounts, a moved row keeps its state outside trees, and tree rows stay expanded by id.
