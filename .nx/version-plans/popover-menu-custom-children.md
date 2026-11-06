---
__default__: patch
---

Widgets can live inside popover menus declaratively. `GtkPopoverMenu`, `GtkPopoverMenuBar` and `GtkMenuButton` take `customChildren`, keyed by the ID in a menu item's `custom` attribute like GtkBuilder's `<child type="ID">`, and the widgets stay in their items when the menu model or its items change, including across Fast Refresh. `GMenu` `items` entries and `<GMenuItem>` also take the other GtkBuilder menu attributes GTK reads: `custom`, `hiddenWhen`, `accel`, `icon`, `verbIcon`, `useMarkup`, `submenuAction`, `displayHint` and `textDirection`. Changing one entry of a `GMenu` now replaces only that entry instead of removing and reinserting every entry after it.
