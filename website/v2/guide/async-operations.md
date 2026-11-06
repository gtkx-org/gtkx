---
title: "Async Operations"
description: "Await native operations, handle failures, and cancel work with Gio.Cancellable."
---

# Async Operations

GTKX turns compatible GIR async/finish pairs into promise-returning methods. Await the method and handle failures with `try`/`catch`.

The promise resolves to the finish function's results: one value directly, or a tuple for several. A leading success boolean is omitted when the finish function also returns output values and failure already throws. Boolean-only results and explicit finish methods keep their native return shape. For example, `loadContentsAsync` resolves to the contents and optional etag, while `replaceContentsAsync` resolves to the etag alone.

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

| Method              | Behavior                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `unpack()`          | Opens the outer container, leaving its children as variants. Dictionary keys are unpacked.                 |
| `deepUnpack()`      | Opens arrays, tuples, dictionaries, and maybes recursively, retaining the variants held inside `v` values. |
| `recursiveUnpack()` | Opens every container, including nested `v` values.                                                        |

Basic values unpack directly. Byte arrays (`ay`) return `Uint8Array` in every mode, and dictionaries return objects, including dictionaries with numeric keys. `deep_unpack()` aliases `deepUnpack()`, and `Variant.new(signature, value)` aliases construction for compatibility with older GJS code.

Passing a string to `new Variant("ay", text)` produces UTF-8 bytes with a trailing NUL, as in GJS; passing a byte array preserves its bytes. GTKX keeps signed and unsigned 64-bit values as `bigint` to preserve their full precision. Construction accepts `bigint` or safe integer numbers for those types.

Unpacking always reads the variant's actual runtime type. An explicit type parameter describes the signature your code expects; it does not validate that signature at runtime. Without a known constructor signature or explicit type parameter, the result is `unknown`.

The generated promise is named `call` here; use the generated signature rather than deriving a name from the C function.

### Consuming a service

`Gio.DBusProxy.newForBus` returns a promise for a proxy to one interface of a remote object. The proxy emits `g-signal` for the service's signals, and `getCachedProperty` reads its properties, which `g-properties-changed` reports when they change. `Gio.DBusObjectManagerClient` lists the objects of a service that exports an object manager, with a proxy for each of their interfaces. `Gio.busWatchName` calls its handlers when a name gains or loses its owner, so a client can create its proxy once the service is running:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";

export const watchCounter = (onValue: (value: number | null) => void) => {
    let proxy: Gio.DBusProxy | null = null;

    const watcher = Gio.busWatchName(
        Gio.BusType.SESSION,
        "com.example.Counter",
        Gio.BusNameWatcherFlags.NONE,
        async (_connection: Gio.DBusConnection, name: string) => {
            const current = await Gio.DBusProxy.newForBus(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                name,
                "/com/example/Counter",
                "com.example.Counter",
            );
            current.connect("g-signal", (_sender, signalName, parameters) => {
                if (signalName === "Changed") onValue(parameters.deepUnpack<"(u)">()[0]);
            });
            proxy = current;
            onValue(current.getCachedProperty("Value")?.unpack<"u">() ?? null);
        },
        (_connection: Gio.DBusConnection | null, _name: string) => {
            proxy = null;
            onValue(null);
        },
    );

    return {
        increment: async (step: number) => {
            if (!proxy) return;
            const reply = await proxy.call("Increment", new Variant("(u)", [step]), Gio.DBusCallFlags.NONE, -1, null);
            onValue(reply.deepUnpack<"(u)">()[0]);
        },
        stop: () => {
            Gio.busUnwatchName(watcher);
            proxy = null;
        },
    };
};
```

GIR types these handlers only as `GObject.Closure`, so annotate their parameters with the types the C documentation gives them, as the example does. A production build may need a value reference to the classes they receive; see [Production bindings](/v2/guide/configuration-and-codegen#production-bindings).

### Exporting an object

`connection.registerObjectWithClosures2` exports an object at a path, given an interface description and three handlers. The method-call handler answers each call exactly once, through the `Gio.DBusMethodInvocation` it receives, with `returnValue` or `returnDbusError`, and may do so after asynchronous work. The property handlers read and write properties; pass `null` for one the interface does not need:

```ts
import * as Gio from "@gtkx/gi/gio";
import { Variant } from "@gtkx/gi/glib";

const COUNTER_XML = `<node>
  <interface name="com.example.Counter">
    <method name="Increment">
      <arg type="u" name="step" direction="in"/>
      <arg type="u" name="value" direction="out"/>
    </method>
    <property name="Value" type="u" access="read"/>
    <signal name="Changed">
      <arg type="u" name="value"/>
    </signal>
  </interface>
</node>`;

export const exportCounter = (connection: Gio.DBusConnection, objectPath: string): (() => void) => {
    const info = Gio.DBusNodeInfo.newForXml(COUNTER_XML).lookupInterface("com.example.Counter");
    if (!info) throw new Error("The interface description has no com.example.Counter");
    let value = 0;

    const registration = connection.registerObjectWithClosures2(
        objectPath,
        info,
        (
            _connection: Gio.DBusConnection,
            _sender: string,
            _path: string,
            interfaceName: string,
            method: string,
            parameters: Variant,
            invocation: Gio.DBusMethodInvocation,
        ) => {
            if (!(invocation instanceof Gio.DBusMethodInvocation)) throw new TypeError("Expected a D-Bus method invocation");
            if (method !== "Increment") {
                invocation.returnDbusError("org.freedesktop.DBus.Error.UnknownMethod", `Unknown method ${method}`);
                return;
            }
            const [step] = parameters.deepUnpack<"(u)">();
            value += step;
            connection.emitSignal(null, objectPath, interfaceName, "Changed", new Variant("(u)", [value]));
            invocation.returnValue(new Variant("(u)", [value]));
        },
        (_connection: Gio.DBusConnection, _sender: string, _path: string, _interfaceName: string, property: string) =>
            property === "Value" ? new Variant("u", value) : null,
        null,
    );

    return () => connection.unregisterObject(registration);
};
```

Call it from an effect and return its cleanup. An application element registers the application on the session bus under its application ID, so `useApplication().getDbusConnection()` gives the connection to export on, and `getDbusObjectPath()` gives the application's object path, which can hold the object or a path below it. To export under another name, own it with `Gio.busOwnName` and export from its bus-acquired handler, which receives the connection.

### GJS D-Bus wrappers

GTKX has no equivalent of GJS's `Gio.DBusProxy.makeProxyWrapper` or `Gio.DBusExportedObject.wrapJSObject`. When porting, replace a proxy wrapper's methods with `proxy.call`, its signals with `g-signal` and its properties with `getCachedProperty`, and export a wrapped object with `registerObjectWithClosures2`. Exporting objects through `Gio.DBusObjectManagerServer` is not supported: it takes `Gio.DBusInterfaceSkeleton` implementations, and JavaScript cannot supply the method table a skeleton returns, so the bindings omit `vfuncGetVtable`.

## Ending work on unmount

When the application quits, GTKX unmounts the tree, and the Node process exits once its event loop has no work left. A pending `fetch` or a running timer keeps the process alive after its window has closed. Abort requests and clear timers in the cleanup of the effect that started them, and start timers in effects rather than at module level:

```tsx
import { useEffect, useState } from "react";

export const useFeed = (url: string, intervalMs: number): string | null => {
    const [body, setBody] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = (): void => {
            fetch(url, { signal: controller.signal })
                .then((response) => response.text())
                .then(setBody)
                .catch((error: unknown) => {
                    if (!controller.signal.aborted) console.error(error);
                });
        };

        refresh();
        const timer = setInterval(refresh, intervalMs);

        return () => {
            clearInterval(timer);
            controller.abort();
        };
    }, [url, intervalMs]);

    return body;
};
```

`gtkx dev` waits a few seconds after the application quits. If the process is still running then, it prints a warning naming the kinds of pending work, such as `Timeout` for a timer or `TCPSocketWrap` for an open connection, and stops. Run the built bundle to see the same work keep a production process alive.

## Handling termination signals

Listen for `SIGINT` and `SIGTERM` with Node's `process.on`, not `GLibUnix.signalAdd`. GTKX quits the application on `SIGINT`, `SIGTERM` and `SIGHUP` while no other listener handles the signal. A listener you add takes over, so finish your cleanup and call `quit()`:

```tsx
import { quit } from "@gtkx/react";
import { useEffect } from "react";

export const useQuitOnSignals = (save: () => void): void => {
    useEffect(() => {
        const handleSignal = (): void => {
            save();
            quit();
        };

        process.on("SIGINT", handleSignal);
        process.on("SIGTERM", handleSignal);

        return () => {
            process.off("SIGINT", handleSignal);
            process.off("SIGTERM", handleSignal);
        };
    }, [save]);
};
```

When the last `GLibUnix.signalAdd` source for a signal is removed, for example on unmount or after a Fast Refresh, GLib resets that signal to its default action. That silently disables GTKX's exit handling and every `process.on` listener, although Node still lists them. The next `SIGTERM` then ends the process without cleanup, and a Vitest worker ends without releasing its headless display.

## Command-line apps

With `HANDLES_COMMAND_LINE`, a second launch of a running app forwards its arguments to the primary instance and waits for its reply. GLib sends that reply when the `Gio.ApplicationCommandLine` is finalized or its `done()` method is called. GTKX finalizes it only after JavaScript garbage-collects the wrapper, so without `done()` the second launch can wait for minutes. Finish every command line in `onCommandLine`, setting the exit status first because `done()` freezes it before GLib applies the handler's return value:

```tsx
import type * as Gio from "@gtkx/gi/gio";

const finish = (commandLine: Gio.ApplicationCommandLine, status: number): number => {
    commandLine.setExitStatus(status);
    commandLine.done();
    return status;
};

export const handleCommandLine = (commandLine: Gio.ApplicationCommandLine, application: Gio.Application): number => {
    application.activate();
    return finish(commandLine, 0);
};
```

Pass the handler as `onCommandLine` on the application element. A handler that answers after asynchronous work calls `setExitStatus` and `done()` when that work completes.

During development, `gtkx dev` passes the arguments after `--` to the application, so `gtkx dev -- notes.txt` starts an app with `HANDLES_OPEN` on that file. pnpm and Yarn 2 or newer pass `--` on to the `dev` script, as in `pnpm dev -- notes.txt`; npm removes the first `--`, so write `npm run dev -- -- notes.txt`. An option before `--` must be one `gtkx dev` defines: `gtkx dev --verbose` stops with an error naming `--verbose` rather than starting the app, so application options always go after `--`.

A GTKX app needs a display even for `--help` and other options that exit before a window opens. The generated `@gtkx/gi/gtk` and `@gtkx/gi/adw` modules initialize GTK when they are imported, before the application parses its command line, so without a Wayland or X11 display the process prints `Failed to open display` and exits with status 1. Run command-line checks of a packaged app, such as a smoke test in a container or CI, inside a desktop session or a virtual display such as `xvfb-run`.

GTKX sets the program name to the last segment of the production application ID before the entry module runs, as GJS does before an app's code. `--help` prints it as the usage line, and GTK's X11 backend uses it as the window class, even when a library such as GStreamer initializes while the app's modules load. A development ID such as `$development: { applicationId: "com.example.Tasks.Devel" }` keeps the name `Tasks` under `gtkx dev`. To choose another name, call `GLib.setPrgname()` before the application starts.

## Keeping a helper process alive

Application elements manage the GLib lifecycle automatically. A standalone Node helper needs an explicit hold while native work is pending; see [helper processes](/v2/guide/workers#keeping-a-helper-process-alive).

## Moving work to a worker

Move CPU-bound computation to a Node worker and send results to the UI thread. [Workers and Helper Processes](/v2/guide/workers) covers bundling, direct source loading in development, and native thread ownership.

## Next

Continue with [Error Handling](/v2/guide/error-handling) for matching GLib error domains and codes.
