---
__default__: minor
---

The MCP server has a `gtkx_press_keys` tool that presses keys through `userEvent.keyboard` on a widget, or on the focused widget when no `widgetId` is given. An agent can now submit a dialog with `{Enter}` from an entry that activates the default response, close it with `{Escape}`, or run a shortcut such as `{Control>}s{/Control}`. Typing a newline with `gtkx_type` or firing `activate` on the entry did not trigger the default response.
