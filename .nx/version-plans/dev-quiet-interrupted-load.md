---
__default__: patch
---

Stopping `gtkx dev` with Ctrl+C or `SIGTERM` while the application is still loading no longer prints Vite's `Error when evaluating SSR module ...: transport was disconnected` with a stack trace.
