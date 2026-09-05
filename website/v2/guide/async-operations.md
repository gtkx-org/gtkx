---
title: "Async Operations"
description: "Awaiting promisified GIO calls, canceling them, and keeping long work off the main thread."
---

# Async Operations

When GIR exposes a conventional async/finish pair, GTKX generates a promise-returning method, so you `await` it like any other promise.

A promisified method resolves to the finish function's useful results, as a tuple when there is more than one:

```ts
loadContentsAsync(cancellable?: Cancellable | null): Promise<[Uint8Array, string | null]>;
```

A failed call rejects, so a leading success boolean is omitted when it would always be `true`. A call left with one result, such as `replaceContentsAsync`, resolves to that value directly. Explicit finish methods such as `loadContentsFinish` keep their native return shape.

The conversion depends on what the library marks as introspectable, not only on an `Async` suffix. In the current GIO GIR, `Gio.File.measureDiskUsageAsync` is not introspectable and is therefore absent, while `copyAsync` and `moveAsync` remain closure-style methods that return `void`. Their synchronous counterparts can block the GTK thread for an unbounded time. Check the generated signature before putting file work on the UI path; use Node filesystem work in a worker or a child process when GIO offers no promise form.

### Callback-only methods and external finish owners

Some GIR metadata names a finish function on another class. `Pk.PackageSack.getDetailsAsync`,
`getUpdateDetailAsync` and `resolveAsync` are annotated with `pk_client_generic_finish`, a `Pk.Client` method,
although the task they start belongs to the sack. GTKX cannot supply that other instance as the finish
function's `this`, so it looks for a finish method on the declaring class instead: the `<name>_finish` sibling
when one exists, otherwise the class's single generic finish method. The sack methods are therefore completed
with `Pk.PackageSack.mergeGenericFinish` and return `Promise<boolean>` like any other async method.

An async method stays callback-based only when no finish method of its own class can be paired with it, for
example when the class declares several generic finish methods. The generated declaration then carries a note
naming the finish function the GIR declares and its owner. Complete such a result on the instance that owns it,
which `Gio.Task.isValid(result, owner)` confirms; an unrelated instance is not a valid receiver, and calling a
finish function on one can crash the process. Wrap the callback at the application boundary:

```ts
import type * as Gio from "@gtkx/gi/gio";

const finishAsPromise = <T>(
    start: (callback: Gio.AsyncReadyCallback) => void,
    finish: (result: Gio.AsyncResult) => T,
): Promise<T> =>
    new Promise((resolve, reject) => {
        start((_source, result) => {
            try {
                resolve(finish(result));
            } catch (error) {
                reject(error);
            }
        });
    });
```

Pass a bound call on the owning instance as `finish`, such as `(result) => owner.someFinish(result)`. Keep the
callback form when the API gives you no instance of the named owner; constructing an unrelated receiver does
not make it the owner of that result.

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

Promisified calls keep an optional `Gio.Cancellable` in its generated position. Some operations also accept an optional progress callback after it. Canceling rejects the pending promise rather than leaving it hanging: GIO operations reject with code `CANCELLED` in the `Gio.IOErrorEnum` domain, GTK4 dialogs with `CANCELLED` in their own `Gtk.DialogError` domain.

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

## Calling D-Bus directly

Raw `Gio.DBusProxy` calls exchange tuple-shaped `GLib.Variant` values. `toVariant` and `fromVariant` from `@gtkx/runtime` pack and unpack them from a GVariant type string:

```ts
import * as Gio from "@gtkx/gi/gio";
import { fromVariant, toVariant } from "@gtkx/runtime";

const proxy = await Gio.DBusProxy.newForBus(
    Gio.BusType.SESSION,
    Gio.DBusProxyFlags.NONE,
    null,
    "org.freedesktop.DBus",
    "/org/freedesktop/DBus",
    "org.freedesktop.DBus",
    null,
);

const reply = await proxy.call(
    "GetNameOwner",
    toVariant("(s)", ["org.freedesktop.DBus"]),
    Gio.DBusCallFlags.NONE,
    -1,
    null,
);
const [owner] = fromVariant("(s)", reply);
```

The literal type string types both the JavaScript input and output. Arrays unpack to arrays, string-keyed dictionaries to records, other dictionaries to `Map`, tuples to arrays, and `ay` to `Uint8Array`. A nested `v` stays a `GLib.Variant`; pass `{ recursive: true }` to `fromVariant` only when discarding that nested type information is intentional. The generated promise is named `call` here because `callSync` is the synchronous form; generated signatures are the authority rather than the C function's `_async` spelling.

## Keeping a helper process alive

An active application element, normally `AdwApplication`, keeps GTKX's GLib integration referenced automatically. A plain Node helper or CLI has no application lifecycle, so pending GIO work alone does not keep the process alive. Add `@gtkx/native` as a direct dependency and hold the integration around the whole operation:

```ts
import { keepAlive } from "@gtkx/native";

keepAlive(true);
try {
    await runGioWork();
} finally {
    keepAlive(false);
}
```

`keepAlive` is a process-wide switch, not a handle attached to one promise. Coordinate overlapping operations so one caller does not disable it while another is still pending, and always release it in `finally` or the process stays alive. Application code should let the application lifecycle manage it.

## Moving work to a worker

CPU-bound JavaScript on the main thread freezes the window, so it belongs in a [Node worker thread](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

The specifier has to be relative and has to name the worker source file as it exists on disk, and the `new URL(...)` has to sit directly inside the `new Worker(...)` call, otherwise `gtkx build` fails.

During `gtkx dev` and Vitest, Node loads the worker and its imports directly rather than from a bundle. Relative imports in that graph must therefore name their `.ts` source files and use syntax supported by Node's type stripping; enums and parameter properties are not available. `gtkx build` bundles the graph and can accept code that native dev or test loading cannot, so exercise each worker in Vitest as well as building it.

Only one thread in a process may own GTKX's GLib integration. In an application, the main thread initializes that process-wide default context, so its workers must not import generated `@gtkx/gi/*` modules or run GTKX native calls. A standalone worker can initialize GTKX only when no other thread in the process has done so. Keep application GI work on the owning main thread; workers compute with Node and post plain data back for that thread to render. A conflicting import fails at bootstrap with an error explaining the ownership rule.

## Desktop trash in headless sessions

Enumerating `trash:///` depends on GVfs and the services in the desktop session, so it can be unavailable on a headless or minimal host even when the freedesktop.org trash directories exist. Reading `$XDG_DATA_HOME/Trash/files` and `$XDG_DATA_HOME/Trash/info` directly is a dependable fallback only for the home-volume trash. It does not include trash directories on other mounted filesystems, so do not present it as the complete desktop Trash.

## Next

Continue with [Error Handling](/v2/guide/error-handling) for matching GLib error domains and codes.
