---
__default__: minor
---

`gtkx dev` applies edits to imported `.css` files and to a module's `injectGlobal` rules in the open window and keeps application state. The edited file or module replaces the rules it installed, so a rule you remove or move to another selector stops applying. A `.css` file imported with `?raw` refreshes the components that import it, without installing its rules. Stylesheet edits used to restart the app.
