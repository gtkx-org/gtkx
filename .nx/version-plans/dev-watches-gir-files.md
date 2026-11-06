---
__default__: patch
---

`gtkx dev` now watches the GIR files its bindings were generated from. Rebuilding a library that lives next to the app into a `girPath` directory, or replacing a vendored GIR file, used to leave the session on the old bindings without a message; it now regenerates bindings and restarts the app, as a configuration change does.
