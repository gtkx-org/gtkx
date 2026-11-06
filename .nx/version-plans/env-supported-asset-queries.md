---
__default__: patch
---

`@gtkx/cli/env`, which the scaffold's `src/gtkx-env.d.ts` references, now types only the imports GTKX builds: `?resource`, `?icon`, `?font`, `?url`, `?raw`, `?inline` and stylesheet imports, plus `import.meta.env`, `import.meta.hot` and `import.meta.glob`. It used to include Vite's browser declarations, which broke `tsc` with `skipLibCheck: false` and let an asset import without a query, such as `import logo from "./logo.svg"`, typecheck and then fail `gtkx build`.
