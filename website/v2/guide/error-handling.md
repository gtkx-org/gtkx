---
title: "Error Handling"
description: "Match native errors by domain and code, and distinguish call failures from fatal errors."
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

Checking a domain narrows the value to an error with `domain` and `code`. Check `error instanceof GLib.Error` when you need its native methods, such as `matches` or `copy`. The generated reference describes each library's domains and codes.

For a native callback that expects an error value, create one through the generated `GLib.Error` API.

## Criticals during binding calls

Some native functions log a `CRITICAL` instead of returning a `GError`. When that happens during a JavaScript-initiated binding call, GTKX throws an ordinary `Error` from the call. It has no native domain or code.

A promisified method rejects if a critical occurs while starting the operation or running its finish function. Catch it around the awaited call just like another failure.

## Errors outside binding calls

A native critical emitted with no active binding call cannot reach the `try`/`catch` that started the work. GTKX reports it through Node's uncaught-exception channel. Addon panics use the same channel, including reports sent from another thread.

Use Node's [`uncaughtExceptionMonitor`](https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor) for synchronous crash reporting while preserving its default process exit. Native state may already be invalid; do not resume normal application work after a fatal error.

GLib `ERROR` messages are also reported, but GLib aborts regardless of JavaScript handling. Lower log levels, including GTK theme warnings, do not become GTKX exceptions; they keep GLib's normal logging behavior.

There is no GTKX option to disable fatal-error reporting. Unhandled failures fail the test suite as well; see [Testing](/v2/guide/testing).

## React error boundaries

An error boundary can replace a failed descendant's rendered UI with a fallback. Use it around a recoverable part of the interface, and render the fallback with GTKX elements. React's [error boundary documentation](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) describes the component contract.

Boundaries do not catch ordinary event-handler failures or arbitrary rejected promises. Catch those failures in the signal handler or around the awaited operation, then update application state to show an error. A boundary also cannot recover from a native fatal error that leaves the process unsafe to continue.

## Next

Continue with [Components](/v2/guide/components) for how GTKX widgets compose and the hooks that drive them.
