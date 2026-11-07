---
title: "Updating GTKX"
description: "Move a GTKX project or workspace to a newer release with gtkx upgrade."
---

# Updating GTKX

GTKX packages are released together under one version. To move a project to the newest release on the dist-tag it follows, such as `beta`, run this from the project directory:

```bash
npx gtkx upgrade
```

Pass a version or dist-tag to choose one, as in `npx gtkx upgrade 2.0.1`, and [`--cwd <dir>`](/v2/guide/cli#gtkx-upgrade) to upgrade a project outside the current directory. To move a 1.x project to 2.0, follow [Upgrading to 2.0](/v2/guide/upgrading-to-2) instead.

## What the command changes

The command rewrites every GTKX package version in the project, or in each package of its workspace, including pnpm catalog entries, and keeps their range operators. A `peerDependencies` range, such as a shared package's `@gtkx/react`, moves only when it does not accept the new version, so a range like `^1.6.0 || ^2.0.0` stays as written. It then installs and deduplicates with the project's package manager.

When the install leaves some GTKX packages on another version, for example through a Yarn catalog, `overrides` or `resolutions`, or a peer range it cannot rewrite still excludes the new version, the command fails and names them. Change those and install again.

`gtkx dev`, `gtkx build` and the other project commands warn when the installed GTKX packages are not all on one version.

## Release days

Before installing, the command exempts GTKX's own packages from the package manager's [release-age gate](/v2/guide/scaffold-options#release-age-gates) at the project or workspace root, so a release published that day installs. If the install still fails, it restores each `package.json`, the lockfile and those settings, so the project stays on its previous release.

## Projects on 2.0.0-beta.12 or earlier

The CLI of 2.0.0-beta.12 and earlier releases has no `upgrade` command. Run the newer one once with `npx @gtkx/cli@beta upgrade`; on a release day, [Upgrading to 2.0](/v2/guide/upgrading-to-2) shows how to run it past a release-age gate.
