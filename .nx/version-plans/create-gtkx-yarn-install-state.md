---
__default__: patch
---

Projects created with Yarn as the package manager now ignore `.yarn/install-state.gz`, so the initial commit no longer includes Yarn's install cache and later installs leave the working tree clean.
