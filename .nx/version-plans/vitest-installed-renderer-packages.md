---
__default__: patch
---

Vitest with `@gtkx/cli/vitest-plugin` now runs installed dependencies that use `@gtkx/react`, such as a GTKX component library published to a registry, through Vite like `gtkx dev` does. Test files that imported one failed with `Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. Received protocol 'virtual:'`, while the same app worked in `gtkx dev` and `gtkx build`.
