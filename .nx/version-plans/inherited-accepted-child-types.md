---
__default__: patch
---

`elements.config.<Type>.acceptedChildTypes` now shows up in the reference page of an element that inherits its `children` slot, such as `GtkSourceView` from `GtkTextView`. The page used to leave out `children` entirely, so the configured child types never appeared in `.gtkx/reference`, `gtkx docs` or the MCP API docs.
