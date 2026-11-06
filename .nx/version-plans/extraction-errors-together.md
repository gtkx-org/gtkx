---
__default__: patch
---

Translation extraction now reports every message it cannot extract in one run, with each file, line and column, instead of stopping at the first one, so `gtkx codegen`, `gtkx dev` and builds no longer need a run per fix.
