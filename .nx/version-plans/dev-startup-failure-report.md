---
__default__: patch
---

`gtkx dev` now reports an error thrown while the application starts, such as from an `onActivate` handler, and keeps the dev server up until the next save. Previously the session printed `Application quit - stopping dev runner...` and exited with status 0 without showing the error.
