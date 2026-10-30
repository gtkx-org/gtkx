---
__default__: patch
---

In a `DropDown` or `ComboRow` popup filtered by `enableSearch`, the checkmark now stays on the selected item, and `renderItem` and `renderListItem` receive the item's position in the full item list as `index`, as documented. They used to receive its position among the search results, so typing in the popup checked whichever result sat at the selected position.
