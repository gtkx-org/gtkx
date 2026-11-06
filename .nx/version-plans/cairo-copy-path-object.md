---
__default__: minor
---

`Context.copyPath()` and `Context.copyPathFlat()` in `@gtkx/cairo` return a `Path`, as in GJS, so the result can be passed to `Gsk.PathBuilder.addCairoPath()` and other bindings that take a Cairo path. `Context.appendPath()` accepts that `Path` as well as an array of segments. Code that read the returned array should call `toData()` on the path, as in `cr.copyPath().toData()`.
