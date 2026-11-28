---
__default__: patch
---

Deployed applications bundle Node.js 26.13.1 by default. A source Flatpak of a pnpm project without a `packageManager` pin installs with pnpm 12.23.0. Debian and RPM packages are built with nfpm 2.49.0, which fixes two security advisories in package generation.
