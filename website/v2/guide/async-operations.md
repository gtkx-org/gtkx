---
title: "Async Operations"
description: "Await generated promises, cancel native operations, and move computation off the GTK thread."
---

# Async Operations

GTKX turns compatible GIR async/finish pairs into promise-returning methods. Await the method and handle failures with `try`/`catch`.

The promise resolves to the finish function's useful results: one value directly, or a tuple for several. A leading success boolean is omitted when failure already throws; explicit finish methods keep their native return shape. For example, `loadContentsAsync` resolves to the contents and optional etag, while `replaceContentsAsync` resolves to the etag alone.

Check the generated signature for the libraries your project binds. An `Async` suffix alone does not establish that a method returns a promise. Some GIO operations, including the closure-based `copyAsync` and `moveAsync`, retain their callback form.

## Awaiting async operations

Create the file dialog through JSX and keep its instance in a callback ref. The portal gives the non-widget object React ownership without placing it inside the button:

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
                    if (dialog && cancellable) void open(dialog, cancellable);
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

Dismissing this dialog rejects with `Gtk.DialogError.DISMISSED`. Match the generated domain and code for expected outcomes, and pass other failures to the application's error handling. Outside production, an error from the finish call also carries the operation's starting stack in its `cause` when that field is available.

## Cancellation with Gio.Cancellable

Promisified methods retain their `Gio.Cancellable` argument. The example renders `GCancellable` from `@gtkx/jsx/gio` in the root portal, captures it with a state callback ref, and passes that instance into `open`.

Cancellation rejects the promise. GIO operations report `Gio.IOErrorEnum.CANCELLED`; GTK dialogs use `Gtk.DialogError.CANCELLED`.

A cancelled instance stays cancelled. Before starting another operation, replace its JSX element, for example by changing its key, and wait for the callback ref to receive the fresh instance. The same rule applies after unmount cleanup or React effect replay cancels an operation.

## Callback-only methods and external finish owners

GTKX pairs an async method with a finish method on its own class. When GIR names a finish function on another class, codegen looks for a matching sibling or an unambiguous generic finish method on the declaring class. For example, PackageKit sack operations use the sack's `mergeGenericFinish`.

If no suitable method exists, the generated method stays callback-based and its declaration identifies the annotated finish owner. Follow that library's async contract and finish the result on its actual owning instance. See [Gio.AsyncResult](https://docs.gtk.org/gio/iface.AsyncResult.html) for the native completion model.

## Calling D-Bus directly

`toVariant` and `fromVariant` convert between JavaScript values and the variants used by `Gio.DBusProxy`. Literal GVariant type strings determine the TypeScript input and output types:

```ts
import * as Gio from "@gtkx/gi/gio";
import { fromVariant, toVariant } from "@gtkx/runtime";

const getNameOwner = async (proxy: Gio.DBusProxy, name: string) => {
    const reply = await proxy.call(
        "GetNameOwner",
        toVariant("(s)", [name]),
        Gio.DBusCallFlags.NONE,
        -1,
        null,
    );
    const [owner] = fromVariant("(s)", reply);
    return owner;
};
```

A nested variant stays a `GLib.Variant` unless recursive unpacking is requested. See the [`fromVariant` reference](/v2/reference/@gtkx/runtime/functions/fromVariant) for conversion options. The generated promise is named `call` here; use the generated signature rather than deriving a name from the C function.

## Keeping a helper process alive

An application element, normally `AdwApplication`, keeps GTKX's GLib integration referenced automatically. A plain Node helper has no application lifecycle, so pending GIO work alone does not keep the process alive. Hold the integration around the operation:

```ts
import { keepAlive } from "@gtkx/runtime";

keepAlive(true);
try {
    await runGioWork();
} finally {
    keepAlive(false);
}
```

`keepAlive` is a process-wide switch. Coordinate overlapping operations and release it after the last one. Application components should leave this to their application element.

## Moving work to a worker

Keep CPU-bound work off the GTK thread with a [Node worker](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

For `gtkx build` to emit the worker, its URL must appear directly inside `new Worker(...)` and name the source file through a relative path.

During `gtkx dev` and Vitest, Node loads the worker's source directly. Its relative imports must name source files, and its syntax must work with [Node's type stripping](https://nodejs.org/api/typescript.html#type-stripping). Exercise workers in tests as well as builds, since the production bundle can accept syntax that direct loading cannot.

Only one thread in a process can own GTKX's GLib integration. An application's main thread owns it, so application workers must use Node APIs and send data back to the main thread; they cannot import generated GI modules or make GTKX native calls. A standalone worker can initialize GTKX when no other thread has done so. Conflicting initialization fails during bootstrap.

Before terminating a worker that owns GTKX, finish its native operations or cancel them and await completion. Disconnect signal handlers and remove other native callback registrations while the worker can still run cleanup. Then call `quit()` from `@gtkx/runtime` and send a cleanup-complete message to the parent. The parent must wait for that message before calling `worker.terminate()`. Calling `quit()` alone does not cancel pending operations or await their callbacks; terminating a worker with live native work or registrations is unsupported.

## Next

Continue with [Error Handling](/v2/guide/error-handling) for matching GLib error domains and codes.
