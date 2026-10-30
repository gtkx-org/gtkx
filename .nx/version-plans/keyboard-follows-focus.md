---
__default__: patch
---

`userEvent.keyboard` and the MCP `gtkx_press_keys` tool now send each key of a sequence to the widget that has focus at that point, as a keyboard does. After a key moved focus outside the target, such as an arrow in an open menu, later keys like `{Enter}` still went to the original widget, so `{ArrowUp}{Enter}` in a popover menu activated the item focus had just left.
