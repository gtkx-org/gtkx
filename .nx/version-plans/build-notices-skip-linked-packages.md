---
__default__: patch
---

`gtkx build` no longer lists linked workspace packages, such as a sibling `packages/ui` package in a monorepo, as bundled third-party code. Only packages installed under `node_modules` appear in the build's notices, so an app that imports its own unlicensed workspace package no longer warns to ask upstream for its license or ships it in the deploy notices with an unknown license.
