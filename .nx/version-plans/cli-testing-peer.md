---
__default__: patch
---

`@gtkx/cli` no longer declares `@gtkx/testing` as an optional peer dependency. MCP widget tools in `gtkx dev` load the application's own `@gtkx/testing` through the dev server, so the CLI never resolved it from its own location, and package managers no longer list it as a missing peer of the CLI. Applications that use MCP widget tools keep `@gtkx/testing` in their own dev dependencies, as before.
