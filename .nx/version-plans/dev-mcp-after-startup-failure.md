---
__default__: patch
---

When the application fails before `gtkx dev` attaches to it, such as an error thrown in `onActivate` or while loading the entry module, MCP tools now answer with the error `gtkx dev` reported, as they already did for errors after startup. They used to wait for the app to register and then tell the agent to start `gtkx dev`, which was already running.
