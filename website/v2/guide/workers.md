---
title: "Workers and Helper Processes"
description: "Run computation away from the UI thread and manage native work outside an application."
---

# Workers and Helper Processes

Move CPU-bound computation to a [Node worker](https://nodejs.org/api/worker_threads.html) so it doesn't block the interface. Native asynchronous I/O can stay on the application thread; [await it](/v2/guide/async-operations) instead.

## Moving work to a worker

Start the worker from the application and send its results back as messages:

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

Only one thread in a process can own GTKX's GLib integration, and in an application that is the main thread. A worker uses Node APIs and posts plain data to the main thread; it cannot import generated GI modules or make GTKX native calls.

For `gtkx build` to emit the worker, its URL must appear directly inside `new Worker(...)` and name the source file through a relative path.

During `gtkx dev` and Vitest, Node loads the worker's source directly, and `gtkx dev` restarts the app when a file the worker loaded changes. The worker's relative imports must name source files or [project files](#importing-files-in-a-worker), and its syntax must work with [Node's type stripping](https://nodejs.org/api/typescript.html#type-stripping). Exercise workers in tests as well as builds, since the production bundle can accept syntax that direct loading cannot.

For imports of TypeScript files, add `"allowImportingTsExtensions": true` to the scaffold's `compilerOptions`; it already uses `NodeNext` and `noEmit`. To have `tsc` report syntax that Node cannot strip, add `"erasableSyntaxOnly": true` as well. `tsc` then rejects parameter properties such as `constructor(private readonly path: string)`, enums, namespaces with code and other TypeScript that would otherwise typecheck and build and only fail with a `SyntaxError` when the worker starts in `gtkx dev` or Vitest. The option applies to the whole project, including code that only Vite compiles.

## Importing files in a worker

A worker imports project files with `?url`, `?raw` and `?inline`, as the main thread does; [Assets](/v2/guide/assets#files-and-text) describes what each provides:

```ts
import { readFileSync } from "node:fs";
import captionsPath from "../../data/captions.txt?url";

const captions = readFileSync(captionsPath, "utf8");
```

During `gtkx dev` and Vitest, a worker started with its own `execArgv` must include `process.execArgv` to keep this support. `?resource`, `?icon` and `?font` make assets available to GTK, so import them from the main thread.

## Standalone workers that own GTKX

In a Node helper that is not a GTKX application, a worker can own GTKX instead of the main thread. A thread starts GTKX when it first loads GTKX code, such as `@gtkx/gi`, `@gtkx/react` or `@gtkx/i18n`, and a second thread that loads GTKX code fails during bootstrap. A helper whose main thread calls `t()` from `@gtkx/i18n` therefore owns GTKX on that thread, so keep `@gtkx/*` imports out of the main thread of a helper that hands GTKX to a worker, and post plain data between them. `gtkx build` sets the program name and the locale on an entry's main thread only when that thread loads GTKX code, so building such a helper leaves GTKX to its worker:

```ts
import { Worker } from "node:worker_threads";

const [folder, output] = process.argv.slice(2);
const worker = new Worker(new URL("./thumbnailer.ts", import.meta.url), { workerData: { folder, output } });
worker.on("message", (message) => {
    if (message === "cleanup-complete") void worker.terminate();
});
```

Before the parent terminates a worker that owns GTKX, the worker must:

1. Finish its native operations, or cancel them and await completion.
2. Disconnect signal handlers and remove other native callback registrations.
3. Call `quit()` from `@gtkx/runtime`.
4. Post a cleanup-complete message. The parent calls `worker.terminate()` only after it arrives.

`quit()` alone does not cancel pending operations or await their callbacks, and terminating a worker with live native work or registrations is unsupported.

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
