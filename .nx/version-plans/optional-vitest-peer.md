---
__default__: patch
---

Projects created without the Vitest setup no longer get Vitest installed by npm and pnpm, and Yarn no longer warns that they do not provide `vitest`: `@gtkx/vitest`, which `@gtkx/cli` installs, now declares Vitest as an optional peer dependency.
