---
__default__: minor
---

`gtkx upgrade` moves every GTKX package in a project or workspace, including pnpm catalog entries, to one release, installs, and fails naming any GTKX package left on another version. Without an argument it picks the newest release on the dist-tag the project follows. It exempts GTKX packages from the package manager's release-age gate and puts the changed files back when the install fails. Other commands warn when the installed GTKX packages are not all on one version, and GTKX packages now depend on each other with caret ranges.
