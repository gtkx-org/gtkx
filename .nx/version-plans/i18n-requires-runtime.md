---
__default__: patch
---

`gtkx dev`, `gtkx build`, `gtkx codegen` and `gtkx deploy` manage `po/` only in projects that install `@gtkx/i18n`. A project with an existing gettext `po/` directory, such as a GNOME app scaffolded in place for a port, used to fail `gtkx dev` and `gtkx build` with `Cannot find module '@gtkx/i18n/package.json'`, and codegen rewrote its `POTFILES.in` and catalogs.
