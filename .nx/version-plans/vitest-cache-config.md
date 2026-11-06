---
__default__: patch
---

Tests now pick up changes to `gtkx.config.ts`, such as turning `reactCompiler` off. Vitest's file-system module cache reused modules transformed under the previous configuration until the cache was deleted. The GTKX Vitest plugin now keys that cache on the project's configuration as well.
