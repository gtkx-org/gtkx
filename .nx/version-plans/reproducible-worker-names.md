---
__default__: patch
---

`gtkx build` now names worker chunks the same way wherever the project lives. Worker file names hashed the worker's absolute path, so building the same sources in another checkout, CI workspace or Flatpak build directory produced a different worker file name, a different chunk that loads it, and a different `bundle.mjs`.
