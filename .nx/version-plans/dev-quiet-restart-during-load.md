---
__default__: patch
---

Saving a file while `gtkx dev` is still loading the application no longer prints Vite's `Error when evaluating SSR module ...: transport was disconnected` and `Application error; stopped the application` before the restart it triggers.
