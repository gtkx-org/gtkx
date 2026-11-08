---
__default__: patch
---

Queries in `@gtkx/testing` follow GTK's accessible names more closely: they read `Gtk.AccessibleText`, match labels by `accessibleLabel`, name menu items without their accelerator, skip hidden popovers and match dialogs once their content is shown. Snapshots print the widget tree instead of empty objects, and widgets without children close in their own tag, so existing snapshots need updating once. `toBeVisible` fails for content its container does not show and says what hides the widget.
