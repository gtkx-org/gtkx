---
__default__: patch
---

`gtkx codegen`, `gtkx dev` and Vitest leave the generated `AGENTS.md` section alone when a Markdown formatter has only rewrapped it, as Prettier and oxfmt do with `proseWrap: "always"`, so the file no longer changes back after every run.
