---
__default__: patch
---

`@gtkx/testing` and MCP now read the text a widget exposes through `Gtk.AccessibleText` when it has no label, text or title getter. `toHaveTextContent` on a `GtkTextView` or on a custom widget that draws its own text, `getByText` on a custom label, debug output and the `text` that `gtkx_query_widgets` reports used to find nothing there. Accessible names are unchanged and still follow GTK's naming rules.
