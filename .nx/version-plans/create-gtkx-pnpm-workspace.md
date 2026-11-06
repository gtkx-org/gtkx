---
__default__: patch
---

`pnpm create gtkx` inside a pnpm workspace whose `packages` include the new app adds the app to that workspace. It used to give the app its own `pnpm-workspace.yaml` and lockfile, which pnpm ignores in a workspace member, so the next install at the root failed with `ERR_PNPM_IGNORED_BUILDS` and commands run from the app treated it as a separate workspace. The scaffold now installs through the workspace and prints the `allowBuilds` entries to add to the root `pnpm-workspace.yaml` when they are missing, without editing that file.
