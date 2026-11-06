---
__default__: patch
---

`gtkx dev` restarts its runner when another app of the workspace regenerates the shared bindings while the application is loading, as when two apps' first `pnpm dev` run together. The application previously loaded two copies of the bindings, rendered some widgets wrongly and MCP could not find its widgets until `gtkx dev` was restarted.
