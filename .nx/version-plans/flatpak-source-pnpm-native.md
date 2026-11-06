---
__default__: patch
---

Source-mode Flatpak manifests for pnpm 12 projects now vendor pnpm's native binary for x86_64 and aarch64 and run it for the offline install. The build used to start a `bin/pnpm.cjs` launcher that pnpm 12 does not ship, so every pnpm 12 project, including new `create-gtkx` projects, failed at its first build command. Source builds also install the application's worker chunks, which they used to leave out.
