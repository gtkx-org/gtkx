---
__default__: patch
---

The GTKX Vitest plugin now stops the run with an explanation when `isolate: false` or `--no-isolate` is set, instead of letting the second test file in a worker time out in `render` with "it was never allocated a size". It also sets `isolate: true` explicitly, so Vitest no longer suggests `isolate: false` in its performance hints.
