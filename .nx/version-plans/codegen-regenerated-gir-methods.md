---
__default__: patch
---

Methods from GIR files regenerated from a typelib with `g-ir-generate` now receive their instance. Those files omit `<instance-parameter>`, so `gtkx codegen` emitted every method of a typelib-only library (such as libspelling on distributions without its GIR) without passing `this`, and calls like `adapter.setEnabled(true)` crashed the app or acted on the wrong object.
