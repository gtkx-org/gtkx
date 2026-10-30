---
__default__: minor
---

`gtkx upgrade` moves every GTKX package to one release. It rewrites each `@gtkx/*` and `create-gtkx` spec in the project, or in every member of its npm, pnpm or Yarn workspace, and the entries of pnpm catalogs, keeping each spec's range operator. It then installs with the project's package manager and deduplicates. Without an argument it picks the newest release on the dist-tag the project already follows, such as `beta`; `gtkx upgrade 2.0.1` or `gtkx upgrade latest` picks one. Bumping versions by hand used to leave undeclared packages such as `@gtkx/codegen` or `@gtkx/native` behind until a separate dedupe, and missed catalog entries that `pnpm update` overwrites.
