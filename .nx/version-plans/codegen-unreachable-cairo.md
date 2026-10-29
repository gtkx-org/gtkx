---
__default__: patch
---

Codegen now stops with an actionable error when `@gtkx/cairo` is installed below the `node_modules` that receives the generated bindings, which npm can leave behind after upgrading one app in a workspace. The bindings used to be written anyway, so `gtkx dev`, Vitest and `gtkx build` failed with `Cannot find package '@gtkx/cairo'` from inside the generated store.
