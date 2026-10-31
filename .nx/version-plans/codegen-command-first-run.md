---
__default__: patch
---

`gtkx codegen` now says whether the bindings were missing or out of date before it generates them, and reports "bindings generated" when it finishes. The first run in a new project used to report "regenerated stale bindings" although nothing had been generated before.
