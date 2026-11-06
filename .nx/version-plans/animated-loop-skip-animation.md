---
__default__: patch
---

A looping spring no longer freezes the application when animations are disabled, such as when GNOME's "Reduce Animation" setting is on or in tests rendered with `@gtkx/testing`. React Spring restarted the loop synchronously forever under `skipAnimation`; `@gtkx/animated` now ends the loop after the pass that finds animations disabled, leaving the spring at the end of that pass.
