---
__default__: patch
---

New TypeScript projects declare the generated project types through `files` in `tsconfig.json` instead of a `/// <reference path>` in `src/gtkx-env.d.ts`, so ESLint's `typescript-eslint` recommended configs and oxlint no longer report `triple-slash-reference` on a fresh scaffold. Existing projects can make the same change: add `"files": ["node_modules/.gtkx/env.d.ts"]` to `tsconfig.json` and delete the `reference path` line.
