---
__default__: patch
---

`userEvent.click` on the selected item a `GtkDropDown` displays, such as `screen.getByText("All")`, now opens the drop-down as a pointer click does. It used to do nothing, and the MCP `gtkx_click` tool reported the click as handled.
