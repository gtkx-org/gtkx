---
__default__: patch
---

`gtkx deploy` now finds the Node.js license when `deploy.node.path` is a symlink to an official Node.js release, such as `tools/node` linked to an unpacked tarball's `bin/node`. The license is read from beside the resolved binary, so the package notices carry it instead of warning that no license file was found.
