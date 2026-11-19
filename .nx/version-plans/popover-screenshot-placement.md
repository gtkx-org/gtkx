---
__default__: patch
---

`screenshot` and `screen.screenshot` draw an open popover where it appears on screen. In a window with client-side decorations the popover was drawn offset by the window's shadow margin, and a popover opened from another popover was drawn away from its button. The MCP `gtkx_take_screenshot` tool captures through the same code.
