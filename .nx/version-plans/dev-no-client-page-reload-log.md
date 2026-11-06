---
__default__: patch
---

`gtkx dev` no longer prints Vite's `(client) page reload` lines when an HTML file in the project changes, as when `vitest run --coverage` writes its HTML report. GTKX serves no pages, so nothing reloaded.
