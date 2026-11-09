---
__default__: major
---

Slots use only their GtkBuilder child type names: `AdwToolbarView` no longer accepts `topBar` and `bottomBar` (use `top` and `bottom`), `GtkOverlay` no longer accepts `overlays` (use `overlay`), and `AdwExpanderRow` takes its nested rows as `children` instead of the `rows` prop.
