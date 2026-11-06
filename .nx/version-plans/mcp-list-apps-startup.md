---
__default__: patch
---

`gtkx_list_apps` now lists the running `gtkx dev` app and Storybook explorer on the first call of a new MCP session. They reconnect to a new server on a two-second timer, so the first call used to answer `[]`, or leave out the explorer, although both were running.
