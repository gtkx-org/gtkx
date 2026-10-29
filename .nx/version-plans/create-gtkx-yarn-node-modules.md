---
__default__: patch
---

Projects created with Yarn as the package manager now include a `.yarnrc.yml` with `nodeLinker: node-modules`, so Yarn 4 installs them into `node_modules` instead of Plug'n'Play, where `gtkx dev`, codegen, tests and builds could not find the GTKX packages.
