---
__default__: patch
---

`userEvent.keyboard` accepts the keys alone, as in Testing Library's `await user.keyboard("{Enter}")`, and sends them to the focused widget of the active window, as `gtkx_press_keys` does without a `widgetId`. It used to fail with `Expected a Gtk.Widget`. Passing a widget first works as before.
