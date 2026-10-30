---
__default__: patch
---

`@gtkx/testing` now names a popover menu item from the label GTK relates it to, leaving out its keyboard accelerator, so `getByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Preferences" })` finds the item for an action with a shortcut. The accelerator text was previously appended, as in "Preferences Ctrl+,".
