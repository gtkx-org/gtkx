---
__default__: patch
---

`create-gtkx` installs the React, Vitest and type package majors GTKX supports with caret ranges rather than `latest`, and exempts GTKX packages from the release-age gate so projects created on a release day install. It accepts any directory name, deriving the package name, display name and application ID from it, and expands `~/`. New projects typecheck `gtkx.config.ts` and `vitest.config.ts`, include `@gtkx/testing` for MCP without pulling in Vitest, and register the MCP server in a workspace root's `.mcp.json`.
