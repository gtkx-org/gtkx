---
__default__: patch
---

Tests no longer load two copies of the generated bindings after `gtkx codegen` regenerates them. Vitest's file-system module cache reused transforms of unchanged files that pointed at the previous binding store, while edited files loaded the new one, so `instanceof` checks between them failed and `@gtkx/testing` queries threw `Expected a Gtk.Widget`. The GTKX Vitest plugin now keys that cache on the current binding store.
