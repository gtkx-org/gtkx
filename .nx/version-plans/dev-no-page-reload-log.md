---
__default__: patch
---

`gtkx dev` no longer prints Vite's `(ssr) page reload` line after every save. GTKX applies each change with Fast Refresh and keeps component state, so the line described a reload that never happened.
