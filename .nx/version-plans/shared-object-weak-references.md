---
__default__: patch
---

Share native object weak references across decoded aliases so repeated object callbacks can traverse large collections without exceeding GLib's weak-reference limit.
