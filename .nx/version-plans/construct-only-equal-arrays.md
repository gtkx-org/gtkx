---
__default__: patch
---

A construct-only array prop given a new array with the same items, such as `strings={units.map((unit) => unit.name)}` on a `<GtkStringList>` model, no longer fails with "Cannot change the construct-only prop" when the component re-renders or Fast Refresh recomputes the array. A different list still requires a new key.
