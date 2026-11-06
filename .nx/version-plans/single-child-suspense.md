---
__default__: patch
---

A `<Suspense>` boundary directly inside a single-child element, such as `GtkScrolledWindow`, `AdwClamp` or `AdwToolbarView`, no longer leaves the element empty when its content loads again after showing the fallback. When a child leaves a slot that shows one child, the slot now shows the remaining child, and custom behaviors receive the children that stay in `DetachInfo.remaining`.
