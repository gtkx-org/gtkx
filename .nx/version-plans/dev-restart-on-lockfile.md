---
__default__: patch
---

`gtkx dev` and `gtkx storybook` now restart the app when the project's lockfile changes, so a dependency installed or updated while the session runs is loaded at its new version. The session used to keep the version it had already imported, and the app could run the old code silently or fail with an error about a missing export.
