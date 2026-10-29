---
__default__: patch
---

`create-gtkx` no longer leaves `latest` as the version of React, Vite, Vitest and the type packages in pnpm projects. pnpm keeps a specifier that is already in `package.json`, so scaffolded pnpm apps recorded the dist-tag instead of a caret range, and a later `pnpm update` could move them to a new major. The scaffold now writes those versions only when it does not install them.
