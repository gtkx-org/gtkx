---
title: "Error Handling"
description: "Match native errors by domain and code, and see how GLib criticals and addon panics surface."
---

# Error Handling

GTKX turns a native `GError` into a thrown `GLib.Error`, which extends JavaScript's `Error`. Generated signatures omit the error output parameter. Promisified methods reject with the same errors; see [Async Operations](/v2/guide/async-operations).

## Matching errors by domain and code

Generated error domains support `instanceof`. The check matches the domain; compare `code` with a member of that same domain to handle a particular failure:

```ts
import * as GLib from "@gtkx/gi/glib";

const parseKeyFile = (contents: string) => {
    const keyFile = GLib.KeyFile.new();

    try {
        keyFile.loadFromData(contents, Buffer.byteLength(contents), GLib.KeyFileFlags.NONE);
        return keyFile;
    } catch (error) {
        if (error instanceof GLib.KeyFileError && error.code === GLib.KeyFileError.PARSE) return null;
        throw error;
    }
};
```

Checking a domain narrows the value to an error with `domain` and `code`. Check `error instanceof GLib.Error` when you need its native methods, such as `matches` or `copy`. As in GJS, `matches` accepts a generated domain in place of its quark, as in `error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)`. The generated reference describes each library's domains and codes.

For a native callback that expects an error value, create one through the generated `GLib.Error` API.

## GLib criticals and warnings

Some native functions report misuse by logging a `CRITICAL` or `WARNING` instead of returning a `GError`. GTKX leaves these messages to GLib, as C and GJS applications do: GLib prints them to standard error, the binding call returns normally, and the application keeps running. A critical usually points at a programming error, such as an invalid argument, so fix the code that triggered it.

GLib's [`G_DEBUG`](https://docs.gtk.org/glib/running.html) environment variable can make criticals or warnings abort the process while you debug them. GLib `ERROR` messages always abort.

## Addon panics

A panic in the GTKX native addon while it handles a binding call throws an ordinary `Error` from that call. It has no native domain or code.

A panic while native code calls back into JavaScript, or on another thread, cannot reach the `try`/`catch` that started the work. GTKX reports it through Node's uncaught-exception channel. Use Node's [`uncaughtExceptionMonitor`](https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor) for synchronous crash reporting while preserving its default process exit. Native state may already be invalid; do not resume normal application work after a panic. An unhandled panic fails the test suite as well; see [Testing](/v2/guide/testing).

## React error boundaries

An error boundary can replace a failed descendant's rendered UI with a fallback. Use it around a recoverable part of the interface, and render the fallback with GTKX elements. React's [error boundary documentation](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) describes the component contract.

Boundaries do not catch ordinary event-handler failures or arbitrary rejected promises. Catch those failures in the signal handler or around the awaited operation, then update application state to show an error. A boundary also cannot recover from an addon panic that leaves the process unsafe to continue.

## Next

Continue with [Components](/v2/guide/components) for how GTKX widgets compose and the hooks that drive them.
