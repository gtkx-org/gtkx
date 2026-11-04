---
__default__: patch
---

Projects created without the Vitest setup now include `@gtkx/testing`, which the MCP widget tools need, so `gtkx_query_widgets`, `gtkx_click` and the other widget tools work in every scaffolded project. `@gtkx/testing` declares Vitest as an optional peer dependency, so installing it for MCP no longer pulls Vitest into a project that does not use it.
