---
title: "Workers and Helper Processes"
description: "Run computation away from the UI thread and manage native work outside an application."
---

# Workers and Helper Processes

Use Node workers for CPU-bound computation. Native asynchronous I/O can usually stay on the application thread; [await it](/v2/guide/async-operations) without blocking the interface.

## Moving work to a worker

Keep CPU-bound work off the GTK thread with a [Node worker](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

For `gtkx build` to emit the worker, its URL must appear directly inside `new Worker(...)` and name the source file through a relative path.

During `gtkx dev` and Vitest, Node loads the worker's source directly, and `gtkx dev` restarts the app when a file the worker loaded changes. Its relative imports must name source files or [`?url`, `?raw` and `?inline` assets](#importing-files-in-a-worker), and its syntax must work with [Node's type stripping](https://nodejs.org/api/typescript.html#type-stripping). For TypeScript imports, add `"allowImportingTsExtensions": true` to the scaffold's `compilerOptions`; it already uses `NodeNext` and `noEmit`. Exercise workers in tests as well as builds, since the production bundle can accept syntax that direct loading cannot.

To have `tsc` report that syntax, add `"erasableSyntaxOnly": true` to `compilerOptions` as well. `tsc` then rejects parameter properties such as `constructor(private readonly path: string)`, enums, namespaces with code and other TypeScript that Node cannot strip, which would otherwise typecheck and build and only fail with a `SyntaxError` when the worker starts in `gtkx dev` or Vitest. The option applies to the whole project, including code that only Vite compiles.

Only one thread in a process can own GTKX's GLib integration. An application's main thread owns it, so application workers must use Node APIs and send data back to the main thread; they cannot import generated GI modules or make GTKX native calls.

## Importing files in a worker

A worker imports project files with `?url`, as the main thread does:

```ts
import { readFileSync } from "node:fs";
import captionsPath from "../../data/captions.txt?url";

const captions = readFileSync(captionsPath, "utf8");
```

The import provides a real file path: the source file during `gtkx dev` and Vitest, and the copy in `dist/` after `gtkx build`. A `?raw` import provides the file's text instead, and an `?inline` import a `data:` URL of its contents, such as an image to embed in a generated HTML or SVG file. Both read the source file during `gtkx dev` and Vitest and are inlined by `gtkx build`. During `gtkx dev` and Vitest, a worker started with its own `execArgv` must include `process.execArgv` to keep this support. `?resource`, `?icon` and `?font` make assets available to GTK, so import them from the main thread. See [Assets](/v2/guide/assets#import-project-data).

## Standalone workers that own GTKX

A standalone worker can initialize GTKX when no other thread has done so. Conflicting initialization fails during bootstrap.

Before terminating a worker that owns GTKX, finish its native operations or cancel them and await completion. Disconnect signal handlers and remove other native callback registrations while the worker can still run cleanup. Then call `quit()` from `@gtkx/runtime` and send a cleanup-complete message to the parent. The parent must wait for that message before calling `worker.terminate()`. Calling `quit()` alone does not cancel pending operations or await their callbacks; terminating a worker with live native work or registrations is unsupported.

## Callbacks from other threads

JavaScript runs only on the thread that owns GTKX, but some libraries call back from threads of their own. GStreamer emits `about-to-finish` on `playbin` and `playbin3`, and `handoff` on `identity` and `fakesink`, from its streaming threads. When native code calls a JavaScript signal handler, callback or virtual function override from another thread, GTKX skips the call, as GJS does, and logs a GLib warning that names the signal and the emitting object:

```text
Gtkx-WARNING **: The JavaScript handler for signal 'about-to-finish' on GstPlayBin3 0x55d0c2a1e0f0 was called on another thread and was skipped. …
```

The application keeps running. The library sees a call that did nothing: a skipped signal handler or callback returns zero, `false` or `null`, and a skipped virtual function override runs the implementation it replaced. The warning appears once per handler. Use signals and messages that reach the main thread instead, such as the pipeline bus.

Gapless playback is the common case. A C or Vala player sets the next track's URI inside `about-to-finish`, which a JavaScript handler cannot do. `playbin` also keeps a `uri` set while it plays and switches to it without a gap when the current track ends, so queue the next track from the bus once the current one starts:

```ts
import * as GLib from "@gtkx/gi/glib";
import * as Gst from "@gtkx/gi/gst";

const tracks = ["file:///music/01.ogg", "file:///music/02.ogg", "file:///music/03.ogg"];
const player = Gst.ElementFactory.make("playbin", "player");
if (player === null) throw new Error("GStreamer's playbin element is not installed");

player.getBus()?.addWatch(GLib.PRIORITY_DEFAULT, (_bus, message) => {
    if (message.type === Gst.MessageType.STREAM_START) {
        const next = tracks.shift();
        if (next !== undefined) player.setProperty("uri", next);
    }
    return GLib.SOURCE_CONTINUE;
});
player.setProperty("uri", tracks.shift() ?? null);
player.setState(Gst.State.PLAYING);
```

With GStreamer 1.28, `playbin3` stalls when its `uri` changes while it plays, so use `playbin` for this.

## Keeping a helper process alive

An application element, normally `AdwApplication`, keeps the Node event loop alive automatically. A plain Node helper has no application lifecycle, so pending GIO work alone does not keep the process alive. Hold the event loop around the operation with `keepAlive` from `@gtkx/runtime`:

```ts
import { keepAlive } from "@gtkx/runtime";

keepAlive(true);
try {
    await runGioWork();
} finally {
    keepAlive(false);
}
```

`keepAlive` is a switch for the current JavaScript environment. Coordinate overlapping operations and release it after the last one. Application components should leave this to their application element. Calling `quit()` releases the hold and prevents it from being enabled again.
