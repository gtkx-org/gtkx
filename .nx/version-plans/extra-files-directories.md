---
__default__: patch
---

`deploy.extraFiles` accepts directories: a directory source installs every file below it, so a helper command's whole `gtkx build --out` output, with chunk names that change between builds, takes one entry. Launcher scripts can run the bundled Node.js runtime at `lib/<binaryName>/node`, and the Deploying guide shows how to ship a helper command.
