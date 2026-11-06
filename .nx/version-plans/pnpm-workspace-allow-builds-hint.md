---
__default__: patch
---

`create-gtkx` inside a pnpm workspace now checks the workspace's `allowBuilds` after installing and, when the section exists, lists only the entries to set inside it. pnpm 12 adds a `set this to true or false` placeholder for `@swc/core` during the scaffold's install, so appending the printed `allowBuilds` block made the next `pnpm install` fail with a duplicate key.
