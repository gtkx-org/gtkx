---
__default__: patch
---

`userEvent.keyboard` and the MCP `gtkx_press_keys` tool now click a focused button as soon as Enter or Space is released, as GTK does for a real key, instead of after GTK's 250 ms activation timeout.
