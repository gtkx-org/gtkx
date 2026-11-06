---
__default__: patch
---

The `tsconfig.json` of a new TypeScript project now includes `gtkx.config.ts` and `vitest.config.ts`, so the `typecheck` script reports configuration errors such as a missing `applicationId` before `gtkx dev` does.
