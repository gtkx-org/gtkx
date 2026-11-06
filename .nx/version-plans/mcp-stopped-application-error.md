---
__default__: patch
---

When an error stops the application in `gtkx dev`, MCP widget tools now answer with that error and say that saving a fix restarts the application. They answered only `Application not initialized`, so an agent could not tell why the app was gone.
