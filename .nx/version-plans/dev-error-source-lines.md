---
__default__: patch
---

Application errors reported by `gtkx dev` and `gtkx storybook` now name the source line that threw. Their stack traces pointed a few lines below it, because Fast Refresh shifted the module without updating its source map.
