---
__default__: patch
---

`gtkx upgrade` moves a project on a prerelease to the stable release once that release supersedes it. It used to follow only the prerelease's own dist-tag, so a beta project never reached the stable release unless the version was passed.
