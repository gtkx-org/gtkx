---
title: "Async Operations"
description: "Await native operations, handle failures, and cancel work with Gio.Cancellable."
---

# Async Operations

GTKX turns compatible GIR async/finish pairs into promise-returning methods. Await the method and handle failures with `try`/`catch`.

The promise resolves to what the finish function returns: one value directly, several as a tuple. When a finish function that can fail returns a success boolean along with output values, the promise drops the boolean, because failure rejects instead. For example, `loadContentsAsync` resolves to `[contents, etag]` and `replaceContentsAsync` to the new etag. A finish function that returns only a boolean still resolves to it, and calling a finish method such as `loadContentsFinish` yourself returns its full native tuple.

Check the generated signature for the libraries your project binds. Not every method ending in `Async` returns a promise. Some GIO operations, including the closure-based `copyAsync` and `moveAsync`, retain their callback form. GIR types their progress and ready handlers only as `GObject.Closure`, so annotate the parameters with the types the C documentation gives them; 64-bit integers such as the `goffset` byte counts of a progress handler arrive as `bigint`.

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

Dismissing this dialog rejects with `Gtk.DialogError.DISMISSED`. Match the generated domain and code for expected outcomes, and pass other failures to the application's error handling. Outside production, the rejection's `cause` holds the stack of the call that started the operation, unless the error already has a cause.

## Cancellation with Gio.Cancellable

Promisified methods retain their `Gio.Cancellable` argument. The example renders `GCancellable` from `@gtkx/jsx/gio` in the root portal, captures it with a state callback ref, and passes that instance into `open`.

Cancellation rejects the promise. GIO operations report `Gio.IOErrorEnum.CANCELLED`; GTK dialogs use `Gtk.DialogError.CANCELLED`.

A cancelled instance stays cancelled. Before starting another operation, replace its JSX element, for example by changing its key, and wait for the callback ref to receive the fresh instance. This also applies to an instance that an effect cleanup cancelled.

## Callback-only methods and external finish owners

GTKX pairs an async method with a finish method on its own class. When GIR names a finish function on another class, codegen looks for a matching sibling or an unambiguous generic finish method on the declaring class. For example, PackageKit sack operations use the sack's `mergeGenericFinish`.

If no suitable method exists, the generated method stays callback-based and its declaration identifies the annotated finish owner. Follow that library's async contract and finish the result on its actual owning instance. See [Gio.AsyncResult](https://docs.gtk.org/gio/iface.AsyncResult.html) for the native completion model.

## D-Bus {#calling-d-bus-directly}

<span id="consuming-a-service"></span><span id="exporting-an-object"></span><span id="gjs-d-bus-wrappers"></span>[D-Bus](/v2/guide/dbus) covers calling services, exporting objects, and packing GVariant values.

## Application lifecycle {#ending-work-on-unmount}

<span id="handling-termination-signals"></span><span id="command-line-apps"></span><span id="keeping-a-helper-process-alive"></span>[Application Lifecycle](/v2/guide/application-lifecycle) covers [ending work on unmount](/v2/guide/application-lifecycle#ending-work-on-unmount), [termination signals](/v2/guide/application-lifecycle#handling-termination-signals), [command-line apps](/v2/guide/application-lifecycle#command-line-apps), and [helper processes](/v2/guide/application-lifecycle#keeping-a-helper-process-alive).

## Moving work to a worker

Move CPU-bound computation to a Node worker and send results to the UI thread. [Workers and Helper Processes](/v2/guide/workers) covers bundling, direct source loading in development, and native thread ownership.
