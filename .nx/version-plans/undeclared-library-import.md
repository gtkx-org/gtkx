---
__default__: patch
---

Importing bindings for a GIR library the project does not declare, such as `@gtkx/gi/soup` without `Soup-3.0` in `libraries`, now fails `gtkx dev`, `gtkx build` and Vitest with `Add "Soup-3.0" to \`libraries\` in gtkx.config.ts`, instead of Vite's message that the subpath is not exported from `@gtkx/gi`.
