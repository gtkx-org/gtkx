---
__default__: patch
---

A source-mode Flatpak manifest now prepares its offline dependency sources from the lockfile committed at the pinned revision, and `gtkx deploy` stops with an error when that commit has no lockfile. A lockfile left out of Git, for example by `.gitignore`, used to pass the preview and fail only inside `flatpak-builder` with `ERR_PNPM_NO_LOCKFILE`, and uncommitted dependency changes produced sources that did not match the checked-out tree.
