---
__default__: patch
---

As in GJS, a registered class's `vfuncDispose` override no longer runs when the instance is disposed after its JavaScript object was garbage-collected. GTKX skips the override, which would have run without the instance's JavaScript state, and runs the parent implementation instead.
