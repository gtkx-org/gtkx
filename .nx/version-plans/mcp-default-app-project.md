---
__default__: patch
---

MCP widget tools called without `applicationId` now use the connected app from the MCP server's own project, and fall back to the first connected app only when none comes from it. They used to answer from whichever app connected first, which changed between restarts. The `gtkx storybook` explorer now registers under the project's application ID with a `.Storybook` suffix, such as `com.example.App.Storybook`, so it no longer replaces the `gtkx dev` app of the same project in MCP and either one can be targeted with `applicationId`.
