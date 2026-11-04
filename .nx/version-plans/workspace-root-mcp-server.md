---
__default__: patch
---

`create-gtkx` adds the new app's MCP server to the `.mcp.json` at the root of an enclosing pnpm, npm or Yarn workspace, where AI clients are usually opened, keeping the servers already there. The entry starts the app's own `gtkx mcp` through the workspace's package manager, so the server uses the app's configuration and bindings. Before, only the app's directory had a `.mcp.json`, and a client opened at the workspace root found no GTKX server.
