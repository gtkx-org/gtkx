---
title: "Async Operations"
description: "How GTKX turns GIO's callback-and-finish async convention into Promise-returning methods you can await, cancel with Gio.Cancellable, and catch as GLib errors."
---

# Async Operations

GIO's async operations come in callback-and-finish pairs: a call taking a `Gio.AsyncReadyCallback` starts the work, and a sibling `_finish` call extracts the result (or the error) once the callback fires. GTKX's codegen gives the async half of each pair a `Promise` return and calls the `_finish` sibling for you, so opening a file dialog, reading the file it hands back, or connecting to the session bus is an ordinary `await`.

Here's an example of a promisified method (from `Gio.File`):

```ts
loadContentsAsync(cancellable?: Cancellable | null): Promise<[boolean, number[], string]>;
```

The result carries the C function's return value first, then its out-parameters: here a success flag, the file's contents, and its etag. A failed call rejects, so you skip straight to the value you want with `const [, contents] = await file.loadContentsAsync(null);`. A call whose C return is void and that has a single out-parameter gives you that value directly instead of a tuple.

## Awaiting async operations

Async operations can be awaited just like regular JS promises:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";

const OpenButton = ({ onFile }: { onFile: (file: Gio.File) => void }) => {
    const parentWindow = useParentWindow();

    const handleOpen = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open file");
        try {
            const file = await dialog.open(parentWindow, null);
            onFile(file);
        } catch (error) {
            if (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED) return;
            if (error instanceof Error) console.error(error.message);
        }
    };

    return <GtkButton iconName="document-open-symbolic" onClicked={() => void handleOpen()} />;
};
```

A rejected async call carries the same `GLib.Error` a synchronous call would throw, so its own `stack` points into the callback that delivered the failure rather than at your code. Outside production, GTKX attaches the stack captured where the operation started as the error's `cause`, so you can trace a failure back to the `await` that began it.

## Cancellation with Gio.Cancellable

Every promisified call accepts an optional `Gio.Cancellable` as its last argument.

Cancelling settles the pending promise: it rejects rather than hanging. GIO operations reject with a GError in the `Gio.IOErrorEnum` domain carrying code `CANCELLED`, while GTK4 dialogs report it in their own domain as `Gtk.DialogError.CANCELLED`. Matching on the domain and code is how a `catch` tells a cancellation apart from a genuine failure and returns quietly instead of reporting it.

```ts
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const runWithTimeout = async (action: (cancellable: Gio.Cancellable) => Promise<void>) => {
    const cancellable = new Gio.Cancellable();
    const timeoutId = setTimeout(() => cancellable.cancel(), 20_000);
    try {
        await action(cancellable);
    } finally {
        clearTimeout(timeoutId);
    }
};

await runWithTimeout(async (cancellable) => {
    const dialog = new Gtk.FileDialog();
    try {
        const file = await dialog.open(null, cancellable);
        // ...
    } catch (error) {
        if (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.CANCELLED) return;
        throw error;
    }
});
```

## Moving work to a worker

Awaiting a GIO operation keeps the interface responsive because the work happens outside JavaScript. Your own CPU-bound code does not get that for free: GTKX drives the GLib main context from the Node main thread, so a long synchronous function freezes the window for its whole duration. Put that work in a [Node worker thread](https://nodejs.org/api/worker_threads.html) instead.

`gtkx build` emits a chunk for a worker whose URL is written inside the construction:

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

The specifier has to be relative and has to name the worker source file as it exists on disk, and the `new URL(...)` has to sit directly in the `new Worker(...)` call. This is the only shape the build recognizes. Hoisting the URL to a variable and passing the variable fails the build rather than shipping a bundle whose worker is missing:

```ts
const WORKER_URL = new URL("./indexer.ts", import.meta.url);
const worker = new Worker(WORKER_URL); // gtkx build: error
```

A worker runs no GTK code. It has no GLib main context and no widget tree, so it computes and posts results back, and the main thread renders them.

## Next

Continue with [Error Handling](/guide/error-handling) for the full story on matching GLib error domains and codes.
