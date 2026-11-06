---
__default__: patch
---

`gtkx dev` reports "regenerating bindings" only when a config, GIR or lockfile change actually regenerates them, instead of on every restart, including in projects with `codegen: false`.
