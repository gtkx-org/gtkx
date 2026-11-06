---
__default__: patch
---

Catalog templates now name the application ID in `Project-Id-Version`, as Meson's gettext integration does, so catalogs that `gtkx codegen` initializes no longer make `gtkx dev` and `gtkx build` warn that the header still has its default value.
