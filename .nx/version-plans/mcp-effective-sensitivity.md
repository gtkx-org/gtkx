---
__default__: patch
---

`gtkx_query_widgets` and `gtkx_get_widget_tree` now report a widget inside a disabled container as `isSensitive: false`. They used to report only the widget's own `sensitive` property, so a switch in a locked preferences row looked clickable to an agent.
