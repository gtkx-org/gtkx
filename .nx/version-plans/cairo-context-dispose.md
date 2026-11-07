---
__default__: minor
---

`Context` from `@gtkx/cairo` now supports `using`: a context declared with `using`, or one whose `[Symbol.dispose]()` is called, drops its native reference at once, as `cairo_destroy` does in C, so a widget that draws in `vfuncSnapshot` through `snapshot.appendCairo(...)` can free each frame's context instead of waiting for garbage collection. Without it, a port of gtk4-demo's Paint, which paints a backing surface into the context and keeps drawing into that surface, grew past 1 GB within half a minute. Later calls on a released context throw, and releasing it again does nothing. Releasing the context a `drawFunc` receives is harmless.
