---
title: "Error Handling"
description: "How GLib's GError model maps onto JavaScript exceptions in GTKX: catching thrown GErrors and matching them by domain and code."
---

# Error Handling

A failing GTKX binding throws a JavaScript exception, so you handle it with `try`/`catch`, exactly as you would around any other JavaScript code. No `GError**` out-parameter ever appears in a JS signature.

Promisified methods reject with the same errors, so `try { await ... } catch` handles synchronous and asynchronous failures identically. See [Async Operations](/guide/async-operations) for the promise model and cancellation.

GErrors come only from GI bindings. Everything else in a GTKX app throws ordinary JavaScript errors, and both land on the same `try`/`catch` channel.

## What you catch: `GLib.Error`

A thrown GError is an instance of `GLib.Error` from `@gtkx/gi/glib`, and that class extends the built-in `Error`. On top of the standard `Error` surface it exposes three fields:

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

## Next

Continue with [Components](/guide/components) for how GTKX widgets compose and the hooks that drive them.
