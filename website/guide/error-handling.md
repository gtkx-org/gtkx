---
description: "How GLib's GError model maps onto JavaScript exceptions in GTKX: catching thrown GErrors, matching them by domain and code, and constructing your own."
---

# Error Handling

GLib-based C libraries report recoverable failures through `GError`: a fallible function takes a `GError**` out-parameter, and the caller checks it after every call. GTKX erases that convention entirely. Every generated binding for a throwing C function (anything marked `throws` in the GObject-Introspection data) checks the out-parameter for you and, when it is set, throws the error as a JavaScript exception. You never see the `GError**` argument in a JS signature, and you never check a return flag: you write `try`/`catch`, exactly as you would around any other JavaScript code.

The same model carries over to asynchronous calls. GIO-style async methods are promisified, so a failed operation rejects its promise with the very same error object a synchronous call would have thrown. `try { await ... } catch` handles both identically. The promise model itself, including cancellation, is covered in [Async Operations](/guide/async-operations).

Failures that are not GErrors, such as passing an argument the native layer cannot convert, surface as plain JavaScript `Error`s rather than `GLib.Error` instances.

## What you catch: `GLib.Error`

A thrown GError is an instance of the generated `GLib.Error` class from `@gtkx/gi/glib`, and that class extends the built-in `Error`. Both `instanceof` checks hold:

```ts
import * as GLib from "@gtkx/gi/glib";

try {
    GLib.fileGetContents("/no/such/file");
} catch (error) {
    error instanceof Error;      // true: it is a real JS Error
    error instanceof GLib.Error; // true: it is also a wrapped GError
}
```

Because it is a real `Error` subclass, it behaves like one everywhere: `String(error)` and `console.error(error)` print the message instead of an opaque object, and rethrowing or wrapping it works as expected. On top of the standard `Error` surface, a `GLib.Error` exposes the three fields of the underlying C struct:

- **`message`** is the human-readable description, the same string GLib produced.
- **`domain`** is the error domain as a numeric GQuark (`GLib.Quark` is `number`). Each library registers its own domains: file errors, GIO I/O errors, GTK dialog errors, and so on.
- **`code`** is the domain-specific error code, a plain number.

Its `name` is `"GLib.Error"`, and it carries a `stack` captured at the point of the failing call, so an uncaught GError in your terminal reads like any other JavaScript stack trace.

## Matching errors by domain and code

The `domain` quark and `code` number are how GLib distinguishes "file not found" from "permission denied" from "the user closed the dialog". GTKX gives you two ways to match them.

### Error domain objects

Any introspected enum that GLib marks as an error domain is generated as an `ErrorDomain` object: it carries the enum members as numeric constants and also works as the right-hand side of `instanceof`, matching any wrapped GError that belongs to that domain. The check is domain-only, so you combine it with a `code` comparison against the same object's members:

```ts
import * as Gio from "@gtkx/gi/gio";

const file = Gio.fileNewForPath("/no/such/file");

try {
    await file.loadContentsAsync();
} catch (error) {
    if (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.NOT_FOUND) {
        // the file does not exist
    } else {
        throw error;
    }
}
```

These domain objects exist in every namespace you bind. A few you will actually meet: `GLib.FileError`, `GLib.KeyFileError`, `GLib.MarkupError`, and `GLib.RegexError` from GLib; `Gio.IOErrorEnum`, `Gio.DBusError`, and `Gio.ResolverError` from GIO; `Gtk.DialogError` and `Gtk.BuilderError` from GTK. Each looks like a plain enum:

```ts
Gtk.DialogError.FAILED;    // 0
Gtk.DialogError.CANCELLED; // 1
Gtk.DialogError.DISMISSED; // 2
```

A successful `instanceof` check against a domain object narrows the value's type to `{ domain, code, message }`, which is enough to branch on the code and log the message. It does not narrow to `GLib.Error`, so if you need methods like `matches` or `copy`, test `error instanceof GLib.Error` instead.

### The `matches` method

`GLib.Error` also has GLib's own comparison, `matches(domain, code)`, which checks domain and code in one call. It takes the raw quark, which you can obtain with `GLib.quarkFromString`:

```ts
import * as GLib from "@gtkx/gi/glib";

if (error instanceof GLib.Error && error.matches(GLib.quarkFromString("g-file-error-quark"), GLib.FileError.NOENT)) {
    // no such file
}
```

The domain-object `instanceof` form is shorter and does not require knowing the quark string, so prefer it; `matches` earns its keep when you already hold a quark, for example one you registered yourself.

## Synchronous calls: `try`/`catch`

Any throwing binding can be wrapped in an ordinary `try`/`catch`. The Tasks app from the tutorial does exactly this around its JSON store in [Data and Persistence](/tutorial/data-and-persistence), falling back to seed data when the file is missing or unreadable:

```ts
import * as GLib from "@gtkx/gi/glib";

export const loadState = (): PersistedState => {
    try {
        if (!GLib.fileTest(TASKS_PATH, GLib.FileTest.EXISTS)) return seed();
        const [ok, bytes] = GLib.fileGetContents(TASKS_PATH);
        if (!ok) return seed();
        const parsed = JSON.parse(decode(bytes)) as PersistedState;
        if (parsed?.version !== SCHEMA_VERSION) return seed();
        return parsed;
    } catch {
        return seed();
    }
};
```

Note what the `catch` covers here: `GLib.fileGetContents` throws a `GLib.Error` in the `GLib.FileError` domain when the read fails, and `JSON.parse` throws a plain `SyntaxError` when the contents are corrupt. Both are ordinary exceptions on the same channel, which is the point of the mapping: one recovery path handles native and JavaScript failures together.

## Asynchronous calls: rejected promises

Promisified methods reject with the same `GLib.Error` objects. The most common place you will handle one is a dialog, because GTK reports "the user dismissed it" as an error in the `Gtk.DialogError` domain. This is adapted from the pickers demo in `examples/gtk-demo`:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const isCancellation = (error: unknown): boolean =>
    (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED) ||
    (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);

const handleOpenFile = async () => {
    const fileDialog = new Gtk.FileDialog();
    try {
        const file = await fileDialog.open(parentWindow, cancellable);
        setFile(file);
    } catch (error) {
        if (isCancellation(error)) return;
        if (error instanceof Error) console.error(error.message);
    }
};
```

Two domains matter here. Dismissing the dialog rejects with `Gtk.DialogError.DISMISSED`. Canceling the operation programmatically, by calling `cancel()` on the `Gio.Cancellable` you passed in, rejects with `Gio.IOErrorEnum.CANCELLED`. Both are expected outcomes rather than failures, so the handler swallows them and only logs everything else.

The final `error instanceof Error` check is the standard way to distinguish real errors (native or JavaScript) from arbitrary thrown values, and since `GLib.Error` extends `Error`, it covers GErrors too.

::: tip Rejections point at their call site
A rejected native promise's `stack` describes the GIO completion callback, not your code. Outside production (`NODE_ENV !== "production"`), GTKX captures the stack of the code that started the async operation and attaches it as the rejection error's `cause`, so logging the error shows where the call originated.
:::

## Constructing GErrors yourself

Some APIs consume GErrors rather than produce them. `GLib.Error.newLiteral(domain, code, message)` builds one, and the `GLib.Error` constructor accepts the same three fields as optional props:

```ts
import * as GLib from "@gtkx/gi/glib";

const SHADER_ERROR = GLib.quarkFromString("my-app-shader-error-quark");

area.setError(GLib.Error.newLiteral(SHADER_ERROR, 0, `Fragment shader compile error:\n${log}`));
```

This is how the gtk-demo Shadertoy example reports GLSL compile failures to `Gtk.GLArea`, which then renders its error state. `GLib.quarkFromString` registers (or looks up) a domain quark for your own error domain; pick a unique, descriptive quark string, conventionally ending in `-quark`. A GError you construct behaves exactly like a caught one: it is an `Error` instance, it matches its domain object via `instanceof`, and you can throw it from your own code if you want callers to handle it with the same domain and code machinery.

## Next

- [Async Operations](/guide/async-operations) covers the promise model these rejections flow through, including `Gio.Cancellable`.
- Run `gtkx docs` in your project to generate reference pages for every element your libraries provide; throwing methods appear there as ordinary methods, with the error parameter already absorbed.
