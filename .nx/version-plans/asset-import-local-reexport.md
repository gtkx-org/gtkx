---
__default__: patch
---

Re-exporting an imported asset under its local name, as in `import captionsPath from "../data/captions.txt?url"; export { captionsPath };`, no longer fails `gtkx dev`, `gtkx build` and Vitest with an error claiming the asset does not export that name.
