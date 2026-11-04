---
__default__: patch
---

`userEvent.click`, `dblClick`, `pointer` and the MCP `gtkx_click` tool now report the primary button and the held modifiers to an application's `GtkGestureClick` handlers. A gesture listening to every button (`button={0}`) that checks `getCurrentButton()` to tell a left click from a right click, or `getCurrentEventState()` for Ctrl+click, previously saw button 0 and no modifiers, so the click did nothing.
