---
__default__: patch
---

`gtkx_list_apps` now reports why it cannot list an app's windows: an app that an error stopped under `gtkx dev` carries that error in place of `windows`, instead of appearing as a running app with no windows.
