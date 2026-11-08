---
__default__: minor
---

`userEvent.keyboard` and the MCP `gtkx_press_keys` tool behave more like a real keyboard: `{Tab}` and arrow keys move focus, each key goes to the widget focused at that point, a target is focused before keys are pressed, and keys reach GTK's own key controllers. `{Escape}` closes popovers and dialogs, Enter or Space clicks a button on release, and `userEvent.keyboard("{Enter}")` without a target sends keys to the focused widget. `userEvent.type` inserts each character as its own edit.
