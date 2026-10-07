---
title: "Async Operations"
description: "Await native operations, handle failures, and cancel work with Gio.Cancellable."
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

Construct the variants used by `Gio.DBusProxy` with `new GLib.Variant(signature, value)`, as in GJS. Literal GVariant type strings determine the TypeScript input and unpacked types. For native replies, supply the expected signature as a type parameter when unpacking:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";

const getNameOwner = async (proxy: Gio.DBusProxy, name: string) => {
    const reply = await proxy.call(
        "GetNameOwner",
        new Variant("(s)", [name]),
        Gio.DBusCallFlags.NONE,
        -1,
        null,
    );
    const [owner] = reply.deepUnpack<"(s)">();
    return owner;
};
```

Variants also expose the [GJS unpacking methods](https://gjs.guide/guides/glib/gvariant.html):

| Method | Behavior |
| --- | --- |
| `unpack()` | Opens the outer container, leaving its children as variants. Dictionary keys are unpacked. |
| `deepUnpack()` | Opens arrays, tuples, dictionaries, and maybes recursively, retaining the variants held inside `v` values. |
| `recursiveUnpack()` | Opens every container, including nested `v` values. |

Basic values unpack directly. Byte arrays (`ay`) return `Uint8Array` in every mode, and dictionaries return objects, including dictionaries with numeric keys. `deep_unpack()` aliases `deepUnpack()`, and `Variant.new(signature, value)` aliases construction for compatibility with older GJS code.

Passing a string to `new Variant("ay", text)` produces UTF-8 bytes with a trailing NUL, as in GJS; passing a byte array preserves its bytes. GTKX keeps signed and unsigned 64-bit values as `bigint` to preserve their full precision. Construction accepts `bigint` or safe integer numbers for those types.

Unpacking always reads the variant's actual runtime type. An explicit type parameter describes the signature your code expects; it does not validate that signature at runtime. Without a known constructor signature or explicit type parameter, the result is `unknown`.

The generated promise is named `call` here; use the generated signature rather than deriving a name from the C function.

## Keeping a helper process alive

Application elements manage the GLib lifecycle automatically. A standalone Node helper needs an explicit hold while native work is pending; see [helper processes](/v2/guide/workers#keeping-a-helper-process-alive).

## Moving work to a worker

Move CPU-bound computation to a Node worker and send results to the UI thread. [Workers and Helper Processes](/v2/guide/workers) covers bundling, direct source loading in development, and native thread ownership.

## Next

Continue with [Error Handling](/v2/guide/error-handling) for matching GLib error domains and codes.
