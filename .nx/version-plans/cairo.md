---
__default__: minor
---

`Context` from `@gtkx/cairo` supports `using` and `[Symbol.dispose]()` to drop its native reference at once, as `cairo_destroy` does, and image surfaces count their pixel memory toward garbage collection, so code that creates surfaces every frame no longer grows to gigabytes. `LinearPattern`, `RadialPattern`, `MeshPattern` and `ToyFontFace` have working constructors. `copyPath()` and `copyPathFlat()` return a `Path`, as in GJS, which `Gsk.PathBuilder.addCairoPath()` accepts; call `toData()` to read its segments.
