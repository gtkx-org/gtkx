---
__default__: patch
---

`gtkx build` sets the program name and the locale on an entry's main thread only when that thread loads GTKX code. A helper built with `gtkx build src/cli/thumbs.ts --out dist-thumbs`, whose main thread only starts a worker that uses GTKX, used to start GTKX on its main thread in every project with `@gtkx/react` or `po/`, so the worker failed with "GTKX is already running on another thread". That error no longer says a worker imported `@gtkx/*` when another thread started GTKX; it names what starts GTKX on a thread.
