---
title: "Error Handling"
description: "How GLib's GError model maps onto JavaScript exceptions in GTKX: catching thrown GErrors and matching them by domain and code."
---

# Error Handling

A failing GTKX binding throws a JavaScript exception, so you handle it with `try`/`catch`, exactly as you would around any other JavaScript code. No `GError**` out-parameter ever appears in a JS signature.

Promisified methods reject with the same errors, so `try { await ... } catch` handles synchronous and asynchronous failures identically. See [Async Operations](/guide/async-operations) for the promise model and cancellation.

GErrors come only from GI bindings. Everything your own code does throws ordinary JavaScript errors, and both land on the same `try`/`catch` channel. A failure that happens underneath your code, inside GTK or inside the GTKX addon, has no call of yours to throw out of, so it arrives on a second channel: see [Failures nothing can throw](#failures-nothing-can-throw).

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

To build a GError of your own rather than catch one, see `GLib.Error.newLiteral` in [OpenGL](/guide/opengl).

## Failures nothing can throw

Not every failure reaches you through a call. GTK reports a broken contract by logging a `CRITICAL` record and returning, GLib logs an `ERROR` for a failure it treats as fatal, and the GTKX native addon can panic on a worker thread with no JavaScript frame above it. None of those can be delivered to a `try`/`catch`, so GTKX raises them as an **uncaught exception** instead of letting them pass as a line on stderr.

That is Node's own channel, and it behaves the way it does in any Node program: with no handler installed, the process prints the error and exits non-zero. Installing one is how you decide otherwise.

```ts
process.on("uncaughtException", (error) => {
    reportToYourCrashService(error);
    process.exit(1);
});
```

Three kinds of failure reach it:

- A GLib `CRITICAL`, which is a `g_return_if_fail` contract violated, such as removing a widget from a box that never adopted it. GTK returns from the call as if nothing happened, so the state you get back afterwards is not the state you asked for.
- A GLib `ERROR`, which GLib itself aborts on. The exception arrives first, so the report carries a JavaScript stack rather than only a C one.
- A panic inside the addon, including one on a worker thread, which is marshalled to the main thread and names the Rust file and line it came from.

Everything below `CRITICAL` is left alone. A `WARNING`, `MESSAGE`, `INFO` or `DEBUG` record prints to stderr and the app carries on, so GTK's theme-parser warnings and the like never become exceptions.

There is no option that turns this channel off, and no way to route these failures back into `try`/`catch`: a handler on `uncaughtException` is the whole of the control you have over them. Under a test runner the same applies, so a critical that was a stderr line before now fails the test that provoked it. See [Testing](/guide/testing).

## Next

Continue with [Components](/guide/components) for how GTKX widgets compose and the hooks that drive them.
