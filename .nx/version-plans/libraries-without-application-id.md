---
__default__: patch
---

A package that is not an application, such as a component library, can now leave `applicationId` out of `defineConfig` and run `gtkx codegen`, `gtkx storybook`, `gtkx docs` and `gtkx mcp` as well as its tests. Codegen writes no `AGENTS.md`, `CLAUDE.md` or `.gtkx/reference` there unless `agents` turns them on, and the Storybook explorer registers as `org.gtkx.Library.Storybook`. `gtkx dev`, `gtkx build` and `gtkx deploy` still need an `applicationId` and say so when it is missing.
