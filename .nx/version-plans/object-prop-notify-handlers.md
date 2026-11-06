---
__default__: patch
---

Generated elements now type `onNotify<Prop>` handlers for writable object properties, such as `onNotifyStyleScheme` on `GtkSourceStyleSchemeChooserButton`, `onNotifyVisibleChild` on `GtkStack` and `onNotifySelectedPage` on `AdwTabView`. These handlers already worked at runtime, but TypeScript rejected them.
