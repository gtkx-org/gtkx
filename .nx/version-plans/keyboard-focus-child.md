---
__default__: patch
---

`userEvent.keyboard` and `gtkx_press_keys` now focus a widget that passes its focus to a child, such as a `GtkMenuButton` to its button, before pressing the keys, so `{Enter}` on a menu button opens its menu. The keys used to go to whichever widget held the window's focus, and `gtkx_press_keys` pointed to an ancestor row that could not open the menu either.
