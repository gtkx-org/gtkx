---
__default__: patch
---

`gtkx build`, `gtkx deploy`, `gtkx codegen` and the other commands that start no application now fail when they receive arguments after `--`, instead of silently ignoring them. pnpm and Yarn pass `--` on to package scripts, so `pnpm run deploy -- --print-manifests` used to build and package every target instead of previewing the manifests.
