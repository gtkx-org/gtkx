---
__default__: patch
---

The `.claude/settings.json` of a new project now also allows the chosen package manager's forms of the project scripts, such as `pnpm dev`, `npm test` or `yarn typecheck`, next to the `npx` commands, so a coding agent that runs the project's own scripts is not asked for permission each time.
