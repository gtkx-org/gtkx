---
__default__: patch
---

`gtkx codegen` writes the command table in the generated `AGENTS.md` section with aligned columns, as Prettier and oxfmt format it, so formatting the file no longer leaves a change that the next `gtkx dev`, `gtkx codegen` or Vitest run reverts.
