---
__default__: patch
---

The version skew warning of `gtkx dev`, `build` and the other commands now also checks the GTKX packages that the project's workspace packages resolve. Before, an app in a workspace whose shared package resolved an older `@gtkx/react` or `@gtkx/cairo` than the app itself got no warning, while `gtkx dev` loaded both copies and failed with "`@gtkx/runtime` was evaluated a second time".
