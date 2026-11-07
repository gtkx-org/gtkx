---
__default__: patch
---

Adaptive windows and dialogs no longer corrupt memory, or crash on quit, when a widget that had focus while a breakpoint changed outlives the window, as GTKX's wrappers often make it do. libadwaita writes into the window's freed breakpoint bin when that widget is finalized, so GTKX now keeps the bin allocated until then.
