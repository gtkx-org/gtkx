---
__default__: patch
---

`@gtkx/testing` now names check and radio menu items from their labels, so `getByRole(Gtk.AccessibleRole.MENU_ITEM_CHECKBOX, { name: "Words" })` finds a menu item backed by a stateful action, as GTK names it for screen readers.
