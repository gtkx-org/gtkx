---
__default__: minor
---

`Context` from `@gtkx/cairo` now has `$dispose()`, with GJS's name and behaviour: it drops the context's native reference at once, as `cairo_destroy` does in C, so a widget that draws in `vfuncSnapshot` through `snapshot.appendCairo(...)` can free each frame's context instead of waiting for garbage collection. Without it, a port of gtk4-demo's Paint, which paints a backing surface into the context and keeps drawing into that surface, grew past 1 GB within half a minute. Later calls on a disposed context throw, and calling `$dispose()` again does nothing. Calling it on the context a `drawFunc` receives is harmless, so GJS code that does so keeps working.
