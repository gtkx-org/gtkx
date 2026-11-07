---
__default__: patch
---

`gtkx build`, `gtkx dev` and Vitest now reject Vite's `?worker` and `?sharedworker` imports with an error that points to `new Worker(new URL("./file.ts", import.meta.url))` from `node:worker_threads`. Node.js has no global `Worker`, so these imports used to build without complaint and then throw a `ReferenceError` when the app created the worker.
