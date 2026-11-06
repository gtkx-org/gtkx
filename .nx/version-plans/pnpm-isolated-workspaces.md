---
__default__: minor
---

GTKX apps now run in pnpm workspaces with pnpm's default isolated `node_modules`, including several apps with different `libraries` and shared component packages. `gtkx dev`, Vitest and `gtkx build` used to fail with module-not-found errors even though `tsc` passed. Codegen now writes the bindings to the workspace root, where the installed GTKX packages can import them, and generates them for the union of the apps' `libraries`. It stops with an error naming the other app when apps need different GIR paths, `elements` or package versions. The same change makes npm workspaces that keep `@gtkx/cairo` inside one app generate working bindings instead of stopping.
