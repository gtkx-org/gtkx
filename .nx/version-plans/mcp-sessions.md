---
__default__: patch
---

MCP tools without `applicationId` answer from the `gtkx dev` app of the server's own project, also while it reconnects, and the Storybook explorer registers under the project's application ID with a `.Storybook` suffix. When the app fails to start or an error stops it, tools answer with that error, and `gtkx dev` reports errors raised during an MCP interaction as it does for real input.
