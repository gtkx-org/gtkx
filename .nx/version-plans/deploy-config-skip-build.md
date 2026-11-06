---
__default__: patch
---

`gtkx deploy --skip-build` no longer rejects an existing build after a change to the `deploy` block alone, such as a new summary, homepage or `flatpak.shouldUseRofilesFuse`. Deployment reads those settings itself, so only changes that affect the build still ask for `gtkx build` again, and that error now says so.
