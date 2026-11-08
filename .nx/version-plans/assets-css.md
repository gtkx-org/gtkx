---
__default__: patch
---

Relative `url()` references and `@import` rules in imported `.css` files work in development, tests and builds, and `gtkx dev` and `gtkx build` warn about `url()` paths GTK cannot load. `?resource` imports bundle files of any type, and a `?resource` stylesheet no longer fails builds at random. `@gtkx/cli/env` types only the imports GTKX builds, so an asset import without a query no longer typechecks, and re-exporting an imported asset works.
