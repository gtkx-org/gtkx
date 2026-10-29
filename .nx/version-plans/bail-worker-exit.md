---
__default__: patch
---

Vitest workers cancelled by `bail` exit cleanly after releasing their headless display, instead of printing `graceful shutdown failed Error: process.exit unexpectedly called` for each worker and waiting to be killed.
