---
__default__: patch
---

MCP tools without `applicationId` now wait for the `gtkx dev` app while it reconnects, instead of answering from the Storybook explorer when `gtkx storybook` runs in the same project. During a `gtkx dev` restart, and in the first seconds of a new MCP session before the app reconnected, they used to query or click the explorer's story without an error.
