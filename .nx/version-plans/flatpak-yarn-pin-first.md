---
__default__: patch
---

A source-mode Flatpak of a Yarn 2 or later project without a `packageManager` pin now stops with the instruction to run `corepack use yarn@<version>` before generating the offline dependency sources, instead of after flatpak-node-generator has processed every package.
