---
title: "Error Handling"
description: "How GLib's GError model maps onto JavaScript exceptions in GTKX: catching thrown GErrors and matching them by domain and code."
---

# Error Handling

A throwing GTKX binding throws a JavaScript exception when it fails, so you handle it with `try`/`catch`, exactly as you would around any other JavaScript code.

GLib-based C libraries report recoverable failures through `GError`: a fallible function takes a `GError**` out-parameter, and the caller checks it after every call. GTKX erases that convention entirely.

Every generated binding for a throwing C function (anything marked `throws` in the GObject-Introspection data) checks the out-parameter for you and, when it is set, throws the error as a JavaScript exception. You never see the `GError**` argument in a JS signature, and you never check a return flag.

The same model carries over to asynchronous calls. GIO-style async methods are promisified, so a failed operation rejects its promise with the same error object a synchronous call would have thrown. `try { await ... } catch` handles both identically. The promise model itself, including cancellation, is covered in [Async Operations](/guide/async-operations).

Failures that are not GErrors, such as passing an argument the native Rust core cannot convert, surface as plain JavaScript `Error`s rather than `GLib.Error` instances. Most errors in a GTKX app are ordinary JavaScript errors, not GErrors: `node:fs` throws Node.js errors with string codes like `"ENOENT"`, `fetch` rejects with a `TypeError`, and `JSON.parse` throws a `SyntaxError`. GErrors appear only when a GI binding fails, and they land on the same `try`/`catch` channel as everything else.

## What you catch: `GLib.Error`

A thrown GError is an instance of the generated `GLib.Error` class from `@gtkx/gi/glib`, and that class extends the built-in `Error`. Both `instanceof` checks hold:

```ts
import * as GLib from "@gtkx/gi/glib";

const data = "not a key file";

try {
    GLib.KeyFile.new().loadFromData(data, Buffer.byteLength(data), GLib.KeyFileFlags.NONE);
} catch (error) {
    error instanceof Error;      // true: it is a JS Error
    error instanceof GLib.Error; // true: it is also a wrapped GError
}
```

Because it is an `Error` subclass, it behaves like one everywhere: `String(error)` and `console.error(error)` print the message instead of an opaque object, and rethrowing or wrapping it works as expected. On top of the standard `Error` surface, a `GLib.Error` exposes the fields of the underlying C struct:

- **`message`** is the human-readable description, the same string GLib produced.
- **`domain`** is the error domain as a numeric GQuark (`GLib.Quark` is `number`). Each library registers its own domains: file errors, GIO I/O errors, GTK4 dialog errors, and so on.
- **`code`** is the domain-specific error code, a plain number.

Its `name` is `"GLib.Error"`, and it carries a `stack` captured at the point of the failing call, so an uncaught GError in your terminal reads like any other JavaScript stack trace.

## Matching errors by domain and code

The `domain` quark and `code` number are how GLib distinguishes "file not found" from "permission denied" from "the user closed the dialog". GTKX generates a domain object for each of these, so you match them with `instanceof` and a `code` comparison.

Any introspected enum that GLib marks as an error domain is generated as an `ErrorDomain` object. It carries the enum members as numeric constants, and it also works as the right-hand side of `instanceof`, matching any wrapped GError that belongs to that domain. The check is domain-only, so you combine it with a `code` comparison against the same object's members:

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

These domain objects are generated in any namespace whose library registers error domains, such as `GLib.KeyFileError`, `Gio.IOErrorEnum`, and `Gtk.DialogError`. `Gtk.DialogError.DISMISSED` is just a number you compare a `code` against.

A successful `instanceof` check against a domain object narrows the value's type to `{ domain, code, message }`, which is enough to branch on the code and log the message. It does not narrow to `GLib.Error`, so if you need methods like `matches` or `copy`, test `error instanceof GLib.Error` instead.

To build a GError of your own rather than catch one, see [OpenGL](/guide/opengl#reporting-failures-to-the-widget), where a `Gtk.GLArea` is handed a custom error to display.

## Asynchronous calls

Promisified methods reject with the same `GLib.Error` objects, so the domain-and-code check above is exactly what a `catch` around an `await` does. The most common place you will write one is a dialog, because GTK4 reports "the user dismissed it" as an error in the `Gtk.DialogError` domain rather than as a return value. [Async Operations](/guide/async-operations#awaiting-async-operations) walks a `Gtk.FileDialog` through that catch, and [Cancellation with Gio.Cancellable](/guide/async-operations#cancellation-with-gio-cancellable) covers the `CANCELLED` code you match the same way.

## Next

Continue with [Components](/guide/components) for how GTKX widgets compose and the hooks that drive them.
