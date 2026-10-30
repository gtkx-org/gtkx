---
__default__: patch
---

Development builds warn when an element that shows one child, such as `AdwToolbarView` content, `GtkScrolledWindow`, `AdwClamp` or window content, or a prop that takes one element, holds two or more visible children. The warning names the element and says only the last child is shown; previously the others were dropped silently. A child hidden behind a `<Suspense>` fallback does not count, and production builds stay silent.
