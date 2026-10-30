---
__default__: patch
---

MCP tools without `applicationId` now answer from the `gtkx dev` app when `gtkx storybook` runs in the same project. They used to pick the app or the Storybook explorer depending on which reconnected first, so the target changed between agent sessions.
