---
__default__: patch
---

`userEvent.keyboard` and `type`, and so the MCP `gtkx_press_keys` tool, no longer run window shortcuts or application accelerators for keys pressed inside an open `AdwDialog` or popover. GTK only lets those reach controllers in the same dialog or popover, so a test could pass with a shortcut that no keyboard can trigger while the dialog is open.
