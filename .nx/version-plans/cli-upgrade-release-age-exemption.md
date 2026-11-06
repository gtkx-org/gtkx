---
__default__: patch
---

`gtkx upgrade` now exempts GTKX's own packages (`@gtkx/*` and `create-gtkx`) from the package manager's release-age gate before installing, adding the entries new projects get from `create-gtkx` to the project's or workspace root's `pnpm-workspace.yaml`, `.yarnrc.yml` (Yarn 4.10 and newer) or `.npmrc` and keeping the rest of the file. Projects created by 2.0.0-beta.12 or earlier lack those entries, so upgrading to a release published that day failed under Yarn 4.15's default one-day gate or a configured pnpm or npm gate. When the install fails, the command now also puts each `package.json`, the lockfile and the settings it changed back as they were; it used to leave `package.json` already pointing at the new release.
