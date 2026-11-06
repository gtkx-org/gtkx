---
__default__: minor
---

`userEvent.keyboard`, and so the MCP `gtkx_press_keys` tool, now moves focus with `{Tab}`, `{Shift>}{Tab}{/Shift}` and arrow keys when the focused widget's own bindings do not use the key, as a keyboard does in the running app. These keys previously left focus where it was, so a test or an agent could not tab through a form. A `GtkTextView` keeps Tab and Enter as text, inserting a tab or a new line.
