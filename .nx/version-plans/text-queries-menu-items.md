---
__default__: patch
---

Text queries in `@gtkx/testing` and the MCP `gtkx_query_widgets` tool now match every rendered label, including the labels of popover menu items, which GTK marks as presentation. `screen.getByText("Dark")` finds an item in an open menu.
