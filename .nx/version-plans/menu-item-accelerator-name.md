---
__default__: patch
---

`@gtkx/testing` now names a widget from the text of a label it is labelled by even when that label has the `presentation` role, as GTK's popover menu items are. A menu item for an action with a keyboard accelerator is named by its label, so `getByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Preferences" })` finds it; the accelerator text was previously appended, as in "Preferences Ctrl+,".
