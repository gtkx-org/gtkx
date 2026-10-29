---
__default__: patch
---

`gtkx dev` and `gtkx storybook` now run dependencies that use `@gtkx/react`, such as a workspace component package built to JavaScript, through Vite like the app's own modules. They used to be loaded by Node directly and failed with `Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. Received protocol 'virtual:'`, while Vitest and `gtkx build` worked.
