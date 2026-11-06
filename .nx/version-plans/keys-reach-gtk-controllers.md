---
__default__: patch
---

`userEvent.keyboard` and the `gtkx_press_keys` MCP tool now send keys to the key controllers GTK's own widgets add, so `{Space}` or `{Enter}` selects a color swatch in `GtkColorChooserWidget` and the dialog of a `GtkColorDialogButton`. Handlers that need a real key event, such as GtkSourceView's, the key capture of search entries and search bars, file choosers, WebKit web views and the deprecated tree view and combo box popups, still do not receive them. `gtkx_click` and `gtkx_press_keys` now say in their result when nothing on the widget or its ancestors handled the click or which keys nothing handled, instead of reporting success; `userEvent` stays silent about unhandled input.
