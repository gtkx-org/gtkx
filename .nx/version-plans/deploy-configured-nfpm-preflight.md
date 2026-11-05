---
__default__: patch
---

`gtkx deploy` now checks the nFPM executable set in `deploy.tools.nfpm` before building, and reports a missing one in its list of missing tools. It used to build the app and any earlier targets first, then stop with a bare `not found` error.
