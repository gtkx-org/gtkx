---
__default__: patch
---

`create-gtkx` inside a pnpm workspace with a catalog no longer takes `react`, `@types/react`, `vite`, `vitest` or `@types/node` from that catalog. A catalog pinning React 18 or Vitest 4 used to give the new app those versions, so its tests failed with `defineCacheKeyGenerator is not a function`, and newer versions were written back into the catalog for the whole workspace.
