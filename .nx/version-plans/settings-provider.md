---
__default__: major
---

`SettingsProvider` from `@gtkx/react` owns the `Gio.Settings` instance of a schema: wrap the app's windows in `<SettingsProvider schema={schema}>`. `useSetting(schema, key)` and `useBindSetting({ schema, key, object, property })` take the instance from the nearest provider for that schema, so the beta signature `useSetting(settings, schema, key)` and the `settings` option of `useBindSetting` are removed, along with the app code that rendered `GSettings` in a portal and shared the instance through context. All readers of a key share one signal connection and one cached value.
