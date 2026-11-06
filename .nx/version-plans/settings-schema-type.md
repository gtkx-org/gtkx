---
__default__: patch
---

`@gtkx/react` now exports the `SettingsSchema` type that `useSetting` and `useBindSetting` accept, so an app can describe a system schema it does not ship, such as `org.gnome.desktop.interface`, in an `as const satisfies SettingsSchema` object and read its keys with checked names and value types. The Assets guide shows the pattern. Written without type arguments, `SettingsSchema` now also checks the shape of `values`.
