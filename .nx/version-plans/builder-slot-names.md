---
__default__: minor
---

Child slots are named after their GtkBuilder child types: `AdwToolbarView` takes `top` and `bottom`, `GtkOverlay` takes `overlay`, and `GtkListBox` gains a `placeholder` slot. The previous `topBar`, `bottomBar` and `overlays` props still work, are marked deprecated in the generated reference and are removed in 3.0.
