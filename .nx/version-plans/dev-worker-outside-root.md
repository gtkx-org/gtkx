---
__default__: patch
---

`gtkx dev` now restarts the app when a worker's module outside the project changes, such as a source-only workspace package that only the worker imports. Edits to such a package used to go unnoticed until the next manual restart, while the Workers guide promises a restart for every file the worker loaded.
