---
__default__: patch
---

`create-gtkx` inside a Yarn workspace no longer writes a `.yarnrc.yml` and `dependenciesMeta` into the new app, where Yarn applies them only when commands run from the app directory, so the next `yarn install` at the workspace root switched the workspace back to Plug'n'Play and the app stopped running. It prints the `nodeLinker` and `dependenciesMeta` entries to add to the workspace root instead, as it does for pnpm and npm workspaces.
