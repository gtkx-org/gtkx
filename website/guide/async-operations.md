---
title: "Async Operations"
description: "Awaiting promisified GIO calls, canceling them, and keeping long work off the main thread."
---

# Async Operations

GTKX turns compatible GIO async/finish pairs into promises. By default in GTKX 1.6, `loadContentsAsync` resolves to the native success flag, a numeric byte array, and the optional etag. A failed call rejects, so callers can skip the success flag when destructuring. A call whose C return is void and that has a single out-parameter resolves to that value directly instead of a tuple.

The [`v2FinishResults` future flag](/guide/configuration-and-codegen#future-flags) removes only the redundant success flag. The separate `v2ByteArrays` flag changes the contents to a `Uint8Array`. With both enabled, `loadContentsAsync` resolves to the contents and optional etag, while `replaceContentsAsync` resolves to its etag directly. Explicit finish methods keep their native return shape.

## Awaiting async operations

GTK4 reports a dismissed dialog as an error rather than as a return value, so a `catch` matching `Gtk.DialogError.DISMISSED` returns quietly:

```tsx
import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GCancellable } from "@gtkx/jsx/gio";
import { GtkButton, GtkFileDialog } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow } from "@gtkx/react";
import { useState } from "react";

type OpenButtonProps = {
    onFile: (file: Gio.File) => void;
    onError: (error: unknown) => void;
};

const OpenButton = ({ onFile, onError }: OpenButtonProps) => {
    const parentWindow = useParentWindow();
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);
    const [cancellable, setCancellable] = useState<Gio.Cancellable | null>(null);
    const [cancellableGeneration, setCancellableGeneration] = useState(0);
    const [isOpening, setIsOpening] = useState(false);

    const open = async (fileDialog: Gtk.FileDialog, current: Gio.Cancellable) => {
        setIsOpening(true);

        try {
            onFile(await fileDialog.open(parentWindow, current));
        } catch (error) {
            if (
                error instanceof Gtk.DialogError &&
                (error.code === Gtk.DialogError.DISMISSED || error.code === Gtk.DialogError.CANCELLED)
            ) {
                return;
            }

            onError(error);
        } finally {
            setIsOpening(false);
            setCancellableGeneration((generation) => generation + 1);
        }
    };

    return (
        <>
            {createPortal(<GtkFileDialog ref={setDialog} />, rootElement)}
            {createPortal(
                <GCancellable key={cancellableGeneration} ref={setCancellable} />,
                rootElement,
            )}
            <GtkButton
                iconName="document-open-symbolic"
                sensitive={dialog !== null && cancellable !== null && !isOpening}
                onClicked={() => {
                    if (dialog !== null && cancellable !== null) void open(dialog, cancellable);
                }}
            />
            <GtkButton
                iconName="process-stop-symbolic"
                sensitive={isOpening && cancellable !== null}
                onClicked={() => cancellable?.cancel()}
            />
        </>
    );
};
```

Outside production, the rejection's `cause` carries the stack captured where the operation started.

## Cancellation with Gio.Cancellable

When a native async function takes a `Gio.Cancellable`, its promisified form accepts one as the last argument. The example renders `GCancellable` from `@gtkx/jsx/gio` in the root portal, captures it with a state callback ref, and passes that instance into `open`.

Canceling rejects the pending promise. GIO operations report `Gio.IOErrorEnum.CANCELLED`; GTK4 dialogs use `Gtk.DialogError.CANCELLED`.

A cancelled instance stays cancelled. Before starting another operation, replace its JSX element, for example by changing its key, and wait for the callback ref to receive the fresh instance. The same rule applies after unmount cleanup or React effect replay cancels an operation.

## Moving work to a worker

CPU-bound JavaScript on the main thread freezes the window, so it belongs in a [Node worker thread](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

The specifier has to be relative and has to name the worker source file as it exists on disk, and the `new URL(...)` has to sit directly inside the `new Worker(...)` call, otherwise `gtkx build` fails.

During `gtkx dev` and Vitest, Node loads the worker and its imports directly rather than from a bundle. Relative imports in that graph must therefore name their `.ts` source files and use syntax supported by Node's type stripping; enums and parameter properties are not available. The 1.6 scaffold uses `NodeNext` with `noEmit`, so add `"allowImportingTsExtensions": true` to `compilerOptions` before importing those source files. `gtkx build` bundles the graph and can accept code that native dev or test loading cannot, so exercise each worker in Vitest as well as building it.

A worker runs no GTK code: it computes and posts results back for the main thread to render.

## Next

Continue with [Error Handling](/guide/error-handling) for matching GLib error domains and codes.
