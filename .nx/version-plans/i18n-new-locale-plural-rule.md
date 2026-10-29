---
__default__: patch
---

Adding a locale whose plural rule `msginit` does not know, such as `ar`, `hi` or `zh_CN`, to `po/LINGUAS` no longer makes `gtkx dev`, `gtkx build` and Vitest fail with `invalid nplurals value`. A new catalog compiles until its first plural translation, which still needs a real `Plural-Forms` header.
