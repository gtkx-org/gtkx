---
__default__: patch
---

`gtkx dev` no longer crashes when an install moves or replaces the GTKX packages it runs from. When the project's `@gtkx/cli` was removed or upgraded, including by `gtkx upgrade` with pnpm, which keeps the previous copy on disk, it now says so, stops the app and exits with status 1, asking you to start it again; when an install only moves it to another copy of the same version, as pnpm does after adding a package such as `@vitest/coverage-v8` that changes its peer dependencies, it restarts the app from that copy; when an install leaves the GTKX packages briefly unresolvable, it reports the codegen error, keeps the app running and restarts it after the next install.
