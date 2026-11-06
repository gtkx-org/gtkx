---
__default__: patch
---

Production builds now place each imported GSettings schema file beside `gschemas.compiled`, and AppImages ship them too, so `Gio.SettingsSchemaKey.getSummary()` and `getDescription()` return the schema's text in `node dist/bundle.mjs` and AppImages instead of `null`, as they already did under `gtkx dev` and in Debian, RPM and Flatpak packages.
