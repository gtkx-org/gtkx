---
__default__: minor
---

Node workers can import project files with `?url`, `?raw` and `?inline` under `gtkx dev` and Vitest, as they already could in `gtkx build`, and `gtkx dev` restarts the app when any file a worker loaded changes. Vite's `?worker` and `?sharedworker` imports are rejected with an error pointing to `new Worker(new URL(...))` from `node:worker_threads`.
