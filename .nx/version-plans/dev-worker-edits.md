---
__default__: patch
---

`gtkx dev` restarts the app when a module or `?raw`/`?url` file loaded by a Node worker changes. Before, the app kept running the worker's old code until the next manual restart.
