---
__default__: patch
---

`gtkx deploy` now stops with an error saying that source-mode Flatpak needs a standalone project when `deploy.flatpak.mode` is `"source"` for an app inside an npm, pnpm or Yarn workspace. It used to ask for a lockfile that was already committed at the workspace root. Prebuilt Flatpaks of workspace members are unaffected, and the Deploying guide now says so.
