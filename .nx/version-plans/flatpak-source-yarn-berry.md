---
__default__: patch
---

Source-mode Flatpak manifests for Yarn 2 or later projects now vendor the Yarn release that `packageManager` pins and install offline with flatpak-node-generator's recipe for those lockfiles. They used to run the SDK's Yarn 1 with Yarn 1's offline mirror, which refuses the pin, so every Yarn 4 project, including new `yarn create gtkx` projects, failed at its first build command. Yarn 1, npm and pnpm manifests are unchanged.
