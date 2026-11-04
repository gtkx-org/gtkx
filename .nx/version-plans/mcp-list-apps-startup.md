---
__default__: patch
---

`gtkx_list_apps` now lists the running `gtkx dev` app on the first call of a new MCP session. The app reconnects to a new server on a two-second timer, so the first call used to answer `[]` although the app was running.
