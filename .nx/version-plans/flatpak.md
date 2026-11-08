---
__default__: patch
---

Source-mode Flatpak manifests build pnpm 12 and Yarn 4 projects offline, install the app's worker chunks and translations, and use the lockfile committed at the pinned revision; workspace members get an error asking for a standalone project. Prebuilt bundles include translations, and `deploy.signing.flatpak` signs the repository commit and the bundle.
