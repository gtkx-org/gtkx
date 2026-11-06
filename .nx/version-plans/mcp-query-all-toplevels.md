---
__default__: patch
---

`gtkx_query_widgets` and `gtkx_get_widget_tree` now search every open window, as `gtkx_list_apps` and screenshots already did. Dialogs that a library creates without attaching them to the application, such as the `GtkSourceStyleSchemeChooserButton` dialog, were listed but their widgets could not be found.
