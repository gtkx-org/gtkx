---
__default__: minor
---

A package that is not an application, such as a component library, can leave out `applicationId` and run `gtkx codegen`, `gtkx storybook`, `gtkx docs`, `gtkx mcp` and its Vitest tests, as the new Component libraries guide section describes. `gtkx dev`, `gtkx storybook` and Vitest run dependencies that use `@gtkx/react` through Vite, and libraries can emit declarations for classes built with `withSignals`, whose base is now typed as `SignalBaseClass`.
