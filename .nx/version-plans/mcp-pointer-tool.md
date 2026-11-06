---
__default__: patch
---

The MCP server has a `gtkx_pointer` tool that presses mouse buttons on a widget with `userEvent.pointer`'s tokens, as `gtkx_press_keys` presses keys. `[MouseRight]` right-clicks a widget, so an agent can open a context menu that a `GtkGestureClick` with `button={Gdk.BUTTON_SECONDARY}` shows; `[MouseMiddle]` presses the middle button, and `[MouseRight>]` and `[/MouseRight]` hold and release a button.
