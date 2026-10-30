---
__default__: patch
---

GTKX packages now depend on each other, and declare their optional `@gtkx/react` and `@gtkx/testing` peers, with caret ranges instead of exact versions. Bumping every `@gtkx/*` version in `package.json` and running `npm install` now upgrades in place instead of failing with `ERESOLVE`. `@gtkx/mcp` and `@gtkx/cli` also declare the `react`, `@types/react` and `vitest` peers their GTKX dependencies need, so Yarn no longer warns about unmet peers.
