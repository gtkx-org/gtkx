---
__default__: patch
---

`gtkx build` now names the source file and the import when a package cannot be resolved, for example `src/stats.ts imports dayjs, which cannot be resolved`, instead of reporting that the bundle resolves it at runtime and suggesting to bundle it.
