---
__default__: patch
---

The `style` prop types CSS custom properties and the longhands GTK accepts, such as `fontVariantNumeric`. `useProperty` on a non-null object no longer adds `undefined`, `useBindSetting` checks property names, `onNotify<Prop>` handlers are typed for object properties, and `@gtkx/react` exports `SettingsSchema` for describing system schemas. Classes that shadow an inherited method stay assignable to their parent types, and `<GtkDropTarget types>` accepts generated classes.
