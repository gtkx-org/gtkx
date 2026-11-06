---
__default__: patch
---

The command table that `gtkx codegen` writes into `AGENTS.md` lists `tsc --noEmit`, `vitest run` and `gtkx storybook` only when the project has TypeScript, Vitest and `@gtkx/storybook` installed, and JavaScript projects created by `create-gtkx` no longer allow coding agents to run `npx tsc --noEmit`. In a JavaScript project that command downloaded and ran the unrelated `tsc` package from npm.
