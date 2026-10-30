---
__default__: patch
---

`userEvent.keyboard`, and so the MCP `gtkx_press_keys` tool, now lets an open popover handle `{Escape}` as GTK does, closing the popover or menu. The key previously skipped the popover and reached its ancestors, so Escape in a popover inside an Adwaita dialog closed the whole dialog, and Escape in a popover elsewhere left it open.
