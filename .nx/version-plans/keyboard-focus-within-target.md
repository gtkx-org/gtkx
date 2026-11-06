---
__default__: patch
---

`userEvent.keyboard` delivers keys to the window's focus widget when the given target contains it, as GTK does. Pressing `{Escape}` on an open `AdwDialog` or `AdwAlertDialog` now closes it, and keys sent to a container reach the controllers of the focused widget inside it.
