---
__default__: patch
---

`gtkx codegen`, `gtkx build` and `gtkx dev` now write the translation catalog template in GNU gettext's layout, the same one `gtkx deploy` writes after adding the desktop and AppStream messages. The two used to rewrite each other's layout and creation date, so the committed `.pot` file changed on every build or deployment. Deployment now also requires `msgcat`, which ships with GNU gettext.
