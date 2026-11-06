---
__default__: patch
---

A `GtkDropDown` whose model is a JSX element no longer calls `onNotifySelected` after mounting with `selected={0}`. A notification that adding or removing children causes is now dropped when the property ends at the value its controlled prop asks for, as it already was when the commit wrote the property itself.
