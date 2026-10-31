---
__default__: patch
---

A Yarn project created by Yarn 2 or newer, such as `corepack yarn@4.18.1 create gtkx`, now pins that release in the new `package.json`'s `packageManager` field before installing, as `yarn init -2` does. The install used to run Corepack's default Yarn instead, which on a machine defaulting to Yarn 1 failed inside Yarn 4's Plug'n'Play environment with `Cannot find module 'pnpapi'`. An existing pin is kept, and an app inside a Yarn workspace leaves the pin to the workspace root.
