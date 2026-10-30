---
__default__: patch
---

`ComboRow` from `@gtkx/components` now shows the selected item as its subtitle when `useSubtitle` is set, and `DropDown` and `ComboRow` filter their popup by the typed text when `enableSearch` is set. Both relied on a text expression the components did not provide, so the subtitle stayed empty and search had nothing to match. Items rendered through `renderItem` with non-primitive values have no text for either.
