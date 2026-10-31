---
__default__: patch
---

A configuration that extends a directory layer, such as `extends: "./layers"` with `layers/gtkx.config.ts`, loads again in every command instead of failing with "Extended configuration does not exist". `gtkx dev`, `gtkx build` and `gtkx deploy` also look for the layer's `gtkx.config.*` file with any supported extension, as `gtkx codegen` does.
