---
__default__: patch
---

`gtkx dev` keeps running when a package install removes the generated `@gtkx/gi` and `@gtkx/jsx` links. The dev runner restores them before it restarts, instead of exiting with `Cannot find package '@gtkx/gi'`.
