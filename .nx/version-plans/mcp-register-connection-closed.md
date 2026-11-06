---
__default__: patch
---

`gtkx dev` no longer logs `error Failed to register with MCP server: MCP error -32000: Connection closed` when the MCP connection closes before the application finishes registering, as when a short MCP client session ends or when the application quits from a tool call. The session reports the disconnection and reconnects as it does for any other closed connection.
