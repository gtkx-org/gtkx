---
__default__: patch
---

`create-gtkx --overwrite` keeps the settings of an existing `.yarnrc.yml` or `pnpm-workspace.yaml` and adds only `nodeLinker` or the `allowBuilds` entries the project needs, and keeps a `packageManager` field that names the chosen package manager. It used to replace both files and drop the field, so a Yarn 4 repository lost its registry and authentication settings and could fall back to the Yarn version corepack defaults to.
