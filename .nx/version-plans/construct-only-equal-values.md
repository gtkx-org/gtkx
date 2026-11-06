---
__default__: patch
---

A construct-only prop given a new but equal value, such as `parameterType={GLib.VariantType.new("s")}` on a `<GSimpleAction>` that re-renders or a module-level variant type re-created by Fast Refresh, no longer fails with "Cannot change the construct-only prop". Values whose class provides `equal()` now count as unchanged when they compare equal; a different value still requires a new key.
