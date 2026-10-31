---
__default__: patch
---

`userEvent.type`, `clear`, `paste`, `keyboard` and `tab`, and so the MCP `gtkx_type` and `gtkx_press_keys` tools, now refuse a widget behind an open `AdwDialog` or `AdwAlertDialog`, as they already did when the dialog opens as its own window in a small parent. They used to type into a field behind an in-window dialog, which no keyboard can reach, and left focus outside the dialog so `{Escape}` no longer closed it. Keys sent to the window or to a widget inside the dialog still reach the dialog.
