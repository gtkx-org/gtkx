---
title: "Error Handling"
description: "How GLib's GError model maps onto JavaScript exceptions in GTKX: catching thrown GErrors and matching them by domain and code."
---

# Error Handling

A failing GTKX binding throws a JavaScript exception, so you handle it with `try`/`catch`, exactly as you would around any other JavaScript code. No `GError**` out-parameter ever appears in a JS signature.

Promisified methods reject with the same errors, so `try { await ... } catch` handles synchronous and asynchronous failures identically. See [Async Operations](/v2/guide/async-operations) for the promise model and cancellation.

GErrors come only from GI bindings. Everything your own code does throws ordinary JavaScript errors, and both land on the same `try`/`catch` channel. GTK and GLib can also report a broken contract by logging a `CRITICAL`; whether that is catchable depends on whether a generated native call is active. A failure with no call to throw out of arrives on a second channel: see [Failures nothing can throw](#failures-nothing-can-throw).

## What you catch: `GLib.Error`

A thrown GError is an instance of `GLib.Error` from `@gtkx/gi/glib`, and that class extends the built-in `Error`. On top of the standard `Error` surface it exposes these fields:

- **`message`**: the human-readable description GLib produced.
- **`domain`**: the error domain, a number.
- **`code`**: the domain-specific error code, a number.

## Matching errors by domain and code

Each error domain is generated as an object that works as the right-hand side of `instanceof`. The check matches the domain only, so pair it with a `code` comparison against the same object's members:

```ts
import * as GLib from "@gtkx/gi/glib";

const contents = "not a key file";
const keyFile = GLib.KeyFile.new();

try {
    keyFile.loadFromData(contents, Buffer.byteLength(contents), GLib.KeyFileFlags.NONE);
} catch (error) {
    if (error instanceof GLib.KeyFileError && error.code === GLib.KeyFileError.PARSE) {
        // not a valid key file
    } else {
        throw error;
    }
}
```

Domain objects exist in every namespace whose library registers them, such as `GLib.KeyFileError`, `Gio.IOErrorEnum`, and `Gtk.DialogError`.

A successful `instanceof` check against a domain object narrows the value to `{ domain, code, message }`, not to `GLib.Error`. Reaching methods like `matches` or `copy` requires testing `error instanceof GLib.Error`.

To build a GError of your own rather than catch one, see `GLib.Error.newLiteral` in [OpenGL](/v2/guide/opengl).

## Criticals during binding calls

Some native functions reject an invalid argument with `g_return_if_fail`: they log a `CRITICAL`, return a sentinel value, and do not set a GError. While a JavaScript-initiated GTKX binding call is on the stack, the addon traps that critical and throws an ordinary `Error` from the call instead of accepting the sentinel. A `try`/`catch` directly around the call catches it. It is not a `GLib.Error` and therefore has no domain or code to match.

A promisified method turns the same throw into a rejection when the critical occurs while starting the operation or running its finish function. Handle it with the same `try { await ... } catch` as any other rejected operation.

## Failures nothing can throw

Not every native failure happens while a generated call can return it. A `CRITICAL` logged later by native work, or on a thread with no active binding call, cannot be delivered to the `try`/`catch` that started that work. GTKX raises it as an **uncaught exception** instead of letting it pass as a line on stderr. Addon panics use the same channel.

That is Node's own channel: with no handler installed, the process prints the error and exits non-zero. A handler can report the failure, but the native state may already be invalid, so exit instead of resuming normal application work.

```ts
process.on("uncaughtException", (error) => {
    reportToYourCrashService(error);
    process.exit(1);
});
```

These kinds of failure reach it:

- A GLib `CRITICAL` emitted when no JavaScript-initiated binding call is active. A critical emitted during one of those calls is the catchable ordinary error described above.
- A GLib `ERROR`, which is also reported through the uncaught-exception channel but which GLib aborts on regardless. An `uncaughtException` handler may record it; it cannot keep the process alive.
- A panic inside the addon, including one on a worker thread, which is marshalled to the main thread and names the Rust file and line it came from.

Everything below `CRITICAL` is left alone. A `WARNING`, `MESSAGE`, `INFO` or `DEBUG` record prints to stderr and the app carries on, so GTK's theme-parser warnings and the like never become exceptions.

There is no option that turns this channel off. `try`/`catch` covers criticals trapped during a binding call, while a handler on `uncaughtException` is the only JavaScript observation point for the failures listed here. Under a test runner, either path fails the test unless the test deliberately catches the ordinary error. See [Testing](/v2/guide/testing).

## Next

Continue with [Components](/v2/guide/components) for how GTKX widgets compose and the hooks that drive them.
