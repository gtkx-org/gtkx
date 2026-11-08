---
__default__: patch
---

The GTKX Vitest plugin keys Vitest's module cache on the configuration and the generated bindings, so tests pick up `gtkx.config.ts` changes and never load two copies of the bindings. Workers exit cleanly when cancelled by `bail` or a signal and stop leftover image loader processes, `render` turns caret blinking off so GLib idle callbacks run, and `isolate: false` is rejected with an explanation.
