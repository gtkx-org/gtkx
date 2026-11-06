---
__default__: minor
---

`LinearPattern`, `RadialPattern`, `MeshPattern` and `ToyFontFace` from `@gtkx/cairo` now have constructors, like `ImageSurface` and `Context`: `new LinearPattern(x0, y0, x1, y1)` creates the same gradient as `Pattern.createLinear`. Previously `new LinearPattern()` type-checked but produced an object that threw "No native handle associated with LinearPattern" on first use.
