---
__default__: patch
---

`create-gtkx` sets up Yarn projects that install and run: it writes `nodeLinker: node-modules`, pins the Yarn release in `packageManager` and works under Plug'n'Play. A pnpm workspace gets the new app as a member, and inside pnpm, npm and Yarn workspaces the scaffold prints the root settings to add instead of writing app-level ones the package manager ignores. `--overwrite` keeps existing `.yarnrc.yml` and `pnpm-workspace.yaml` settings.
