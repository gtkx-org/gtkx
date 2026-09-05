---
title: "Async Operations"
description: "Awaiting promisified GIO calls, canceling them, and keeping long work off the main thread."
---

# Async Operations

GIO async methods return promises, so you `await` them like any other promise.

A promisified method resolves to the C function's return value first, then its out-parameters, as a tuple:

```ts
loadContentsAsync(cancellable?: Cancellable | null): Promise<[boolean, number[], string | null]>;
```

A failed call rejects, so the leading success boolean can be skipped with `const [, contents] = await file.loadContentsAsync(null);`. A call whose C return is void and that has a single out-parameter resolves to that value directly instead of a tuple.

Under the [`v2FinishResults` future flag](/guide/configuration-and-codegen#future-flags) the boolean is dropped from the promise entirely: `loadContentsAsync` resolves to `[Uint8Array, string | null]`, and a call left with a single out-parameter, such as `replaceContentsAsync`, resolves to that value directly. The finish methods themselves, like `loadContentsFinish`, keep the boolean.

## Awaiting async operations

GTK4 reports a dismissed dialog as an error rather than as a return value, so a `catch` matching `Gtk.DialogError.DISMISSED` returns quietly:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";

const OpenButton = ({ onFile }: { onFile: (file: Gio.File) => void }) => {
    const parentWindow = useParentWindow();

    const handleOpen = async () => {
        try {
            onFile(await new Gtk.FileDialog().open(parentWindow, null));
        } catch (error) {
            if (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED) return;
            throw error;
        }
    };

    return <GtkButton iconName="document-open-symbolic" onClicked={() => void handleOpen()} />;
};
```

Outside production, the rejection's `cause` carries the stack captured where the operation started.

## Cancellation with Gio.Cancellable

Every promisified call accepts an optional `Gio.Cancellable` as its last argument. Canceling rejects the pending promise rather than leaving it hanging: GIO operations reject with code `CANCELLED` in the `Gio.IOErrorEnum` domain, GTK4 dialogs with `CANCELLED` in their own `Gtk.DialogError` domain.

```ts
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const openWithTimeout = async (parent: Gtk.Window | null) => {
    const cancellable = new Gio.Cancellable();
    const timeoutId = setTimeout(() => cancellable.cancel(), 20_000);

    try {
        return await new Gtk.FileDialog().open(parent, cancellable);
    } catch (error) {
        if (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.CANCELLED) return null;
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};
```

## Moving work to a worker

CPU-bound JavaScript on the main thread freezes the window, so it belongs in a [Node worker thread](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

The specifier has to be relative and has to name the worker source file as it exists on disk, and the `new URL(...)` has to sit directly inside the `new Worker(...)` call, otherwise `gtkx build` fails.

During `gtkx dev` and Vitest, Node loads the worker and its imports directly rather than from a bundle. Relative imports in that graph must therefore name their `.ts` source files and use syntax supported by Node's type stripping; enums and parameter properties are not available. `gtkx build` bundles the graph and can accept code that native dev or test loading cannot, so exercise each worker in Vitest as well as building it.

A worker runs no GTK code: it computes and posts results back for the main thread to render.

## Next

Continue with [Error Handling](/guide/error-handling) for matching GLib error domains and codes.
