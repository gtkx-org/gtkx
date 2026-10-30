---
__default__: minor
---

`userEvent.click` and the other pointer helpers, and so the MCP `gtkx_click` tool, now refuse a widget a pointer cannot reach: one behind an open `AdwDialog` or `AdwAlertDialog`, or inside a widget whose `canTarget` is off. They fail with an error naming the dialog or widget that blocks the target, after waiting the usual actionability timeout. They used to click it anyway, so a test or an agent could change the page behind a dialog, which no user can do. Keyboard helpers are unchanged.
