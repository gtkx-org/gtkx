---
__default__: minor
---

MCP widget summaries from `gtkx_query_widgets` and `gtkx_get_widget_props` now report the widget's accessible name as `name`, so header buttons and icon-only buttons read as "New Note" or "Delete Note" instead of `"GtkButton"`. This replaces the GTK widget name that `name` used to carry; agents or scripts that read `name` for the widget's type should read `type` instead.
