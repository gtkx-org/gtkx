---
__default__: patch
---

`toBeVisible` now fails for a widget its container does not show, such as the content of a collapsed `GtkRevealer` or `AdwBanner` or an inactive `GtkStack` page, which queries already treated as gone. The failure says which ancestor is not shown by its parent.
