---
__default__: minor
---

GTKX apps run in pnpm workspaces with isolated `node_modules`: codegen writes the bindings to the workspace root, and each app can import only the libraries it declares. An app treats the sources of its linked workspace packages as its own, extracting their `t()` messages and bundling their icons and schemas, and npm workspace apps keep their bindings across `npm install`. Importing a library the project does not declare fails with the entry to add to `libraries`.
