---
__default__: patch
---

`gtkx dev` no longer crashes when an install moves or replaces the GTKX packages it runs from. When `@gtkx/cli` itself was moved, removed or upgraded, it now says so, stops the app and exits with status 1, asking you to start it again; when an install leaves the GTKX packages briefly unresolvable, it reports the codegen error, keeps the app running and restarts it after the next install.
