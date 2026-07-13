---
description: "How GTKX turns GIO's callback-and-finish async convention into Promise-returning methods you can await, cancel with Gio.Cancellable, and catch as GLib errors."
---

# Async Operations

GNOME's platform libraries share one asynchronous convention. An operation starts with a method that takes a `Gio.AsyncReadyCallback`, and a sibling `_finish` method extracts the result (or the error) once the callback fires. In C that means threading a callback and a `GAsyncResult` through every async call. In GTKX you never see that machinery: codegen detects every callback-and-finish pair on a class and generates a single method that returns a `Promise`, so reading a file, opening a file dialog, or querying the clipboard is an ordinary `await`.

This works because the generator reads the same GObject-Introspection data that defines the C API. A method is promisified when it either ends in `_async` with a matching `_finish` sibling (the classic GIO shape, like `g_file_load_contents_async` plus `g_file_load_contents_finish`) or takes an `AsyncReadyCallback` and has a `_finish` sibling without the suffix (the GTK4 dialog shape, like `gtk_file_dialog_open` plus `gtk_file_dialog_open_finish`). Methods ending in `_finish` are never promisified themselves.

The method keeps its own camelCase name. There is no renaming and no suffix stripping: `load_contents_async` becomes `loadContentsAsync`, and `Gtk.FileDialog`'s `open` is just `open`. If you know the C API or the GJS one, you already know what the method is called here.

## What the signatures look like

Promisification reshapes the signature in three ways. The callback parameter disappears, since the promise replaces it. The `Gio.Cancellable` parameter survives but becomes a trailing optional, so you only mention it when you need cancellation. And the return type is a `Promise` of whatever the `_finish` method returns, with C out-parameters folded into a tuple. These are the generated signatures, verbatim from `@gtkx/gi`:

```ts
// Gio.File
loadContentsAsync(cancellable?: Cancellable | null): Promise<[boolean, number[], string]>;
queryInfoAsync(attributes: string, flags: FileQueryInfoFlags, ioPriority: number, cancellable?: Cancellable | null): Promise<FileInfo>;

// Gtk.FileDialog
open(parent: Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>;

// Adw.AlertDialog
choose(parent: Gtk.Widget | null, cancellable?: Gio.Cancellable | null): Promise<string>;

// Gdk.Clipboard
readTextAsync(cancellable?: Gio.Cancellable | null): Promise<string | null>;
```

`loadContentsAsync` shows the tuple folding: the C function returns a boolean and fills two out-parameters (the contents and an etag), so the promise resolves to all three at once. `choose` resolves to the response ID string you registered on the alert dialog. The `_finish` methods (`loadContentsFinish`, `openFinish`, and so on) are still generated alongside the promise-returning ones, but there is no reason to call them yourself.

## Awaiting in components

Async platform calls slot into React exactly where you would expect: event handlers and effects. Signal handler props like `onClicked` are synchronous, so the pattern is to define an `async` function and kick it off with `void`, letting the promise settle on its own. This file picker is adapted from the gtk-demo examples:

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

Note what `await dialog.open(...)` gives you that the C API cannot: the dialog result, the user dismissing the dialog, and any I/O failure all flow through one `try`/`catch`, in the order your code reads.

In effects, the same pattern applies, and the effect cleanup is the natural place to cancel work that is still in flight when the component unmounts or the dependency changes:

```tsx
import * as Gio from "@gtkx/gi/gio";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useEffect, useState } from "react";

const FileContents = ({ path }: { path: string }) => {
    const [text, setText] = useState("");

    useEffect(() => {
        const cancellable = new Gio.Cancellable();
        const load = async () => {
            const file = Gio.fileNewForPath(path);
            const [, contents] = await file.loadContentsAsync(cancellable);
            setText(new TextDecoder().decode(new Uint8Array(contents)));
        };
        load().catch((error) => {
            if (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED) return;
            if (error instanceof Error) console.error(error.message);
        });
        return () => cancellable.cancel();
    }, [path]);

    return <GtkLabel label={text} />;
};
```

Everything resolves on the one JavaScript thread your components run on. GTKX drives the GLib main context from Node's event loop, GIO posts async completions back to that context, and the promise settles in the same tick the completion dispatches. There is no worker thread and no cross-thread marshaling, so an `await` continuation can call `setState` or touch widget refs directly.

## Cancellation with Gio.Cancellable

Every promisified method accepts an optional `Gio.Cancellable` as its last argument. Construct one, pass it in, and call `cancel()` to abort the operation; the pending promise then rejects with a `Gio.IOErrorEnum.CANCELLED` error. Passing `null` or omitting the argument means the operation runs to completion.

One cancellable can be shared across several calls, and canceling is safe at any point, including after the operation already finished. The gtk-demo pickers use this to put a deadline on a dialog:

```tsx
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
    const file = await dialog.open(null, cancellable);
    // ...
});
```

Cancellation and dismissal are distinct rejections: canceling via the cancellable produces `Gio.IOErrorEnum.CANCELLED`, while the user closing a GTK dialog produces `Gtk.DialogError.DISMISSED`. Code that treats both as "the user changed their mind" checks for either:

```ts
const isCancellation = (error: unknown): boolean =>
    (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED) ||
    (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);
```

## What stays callback-based

Promisification applies to instance methods with a genuine `AsyncReadyCallback` finish pair. Two categories keep their raw callback shape.

Module-level and static functions are generated as-is, callback and finish function both:

```ts
import * as Gio from "@gtkx/gi/gio";

Gio.busGet(Gio.BusType.SESSION, null, (source, result) => {
    const connection = Gio.busGetFinish(result);
    // ...
});
```

Functions whose callback is not an `AsyncReadyCallback` are also left alone, because there is no finish step to fold into a promise. `Gtk.printRunPageSetupDialogAsync` takes a `PageSetupDoneFunc` that receives the resulting page setup directly, so you call it with a plain callback:

```tsx
const settings = new Gtk.PrintSettings();
Gtk.printRunPageSetupDialogAsync(parentWindow, null, settings, (pageSetup) => {
    // use pageSetup
});
```

::: info
The suffix in that name comes from GTK, not from the promisification rule. Whether a method returns a promise is determined by the callback-and-finish pair, and the generated TypeScript signature always tells you: a `Promise<...>` return means `await`, a `void` return with a callback parameter means callback.
:::

## Rejections are GLib errors

When an async operation fails, the `_finish` step raises a `GError`, and the promise rejects with a wrapped error object carrying the GLib `domain`, `code`, and `message`. Error enums like `Gio.IOErrorEnum` and `Gtk.DialogError` support `instanceof` against these wrapped errors by matching the domain, which is how the `isCancellation` check above works. Outside production builds, the rejection also carries a `cause` whose stack points at the line that started the operation, so an error that surfaces deep in the main loop still traces back to your `await` site. The full story of matching domains and codes is covered in [Error Handling](/guide/error-handling).
