---
__default__: patch
---

A project that `npm create gtkx` or `pnpm create gtkx` sets up with Yarn now pins the Yarn release that installs it in `packageManager` when that release is Yarn 2 or newer, as it already did when Yarn ran the scaffold. Without the pin, a machine whose Corepack defaults to Yarn 1 reinstalled the project with Yarn 1, rewriting its Yarn 4 lockfile.
