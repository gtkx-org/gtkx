---
__default__: patch
---

`create-gtkx` now exempts GTKX's own packages (`@gtkx/*` and `create-gtkx`) from the package manager's release-age gate, so a project created on the day of a GTKX release installs it while every other dependency keeps the gate: `npmPreapprovedPackages` in `.yarnrc.yml` for Yarn 4.10 and newer, `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, and `min-release-age-exclude` in `.npmrc`. Yarn 4.18 quarantines packages published within the last day by default, so its install used to fail on every release day. Inside a workspace, the entries are printed for the root configuration, also when the install fails.
