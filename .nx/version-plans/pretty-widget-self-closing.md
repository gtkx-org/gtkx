---
__default__: patch
---

`screen.debug()`, `prettyWidget`, widget snapshots and the MCP `gtkx_get_widget_tree` tool now close a widget with no text and no children in its own tag, as in `<Box name="GtkBox" role="generic" />`. They used to print only its opening tag, so the widgets after it read as its children. Snapshots that contain such widgets need updating once.
