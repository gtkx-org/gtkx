---
title: "Error Handling"
description: "Match native errors by domain and code, and see how GLib criticals, uncaught exceptions and addon panics surface."
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
        keyFile.loadFromData(
            contents,
            Buffer.byteLength(contents),
            GLib.KeyFileFlags.NONE,
        );
        return keyFile;
    } catch (error) {
        if (
            error instanceof GLib.KeyFileError &&
            error.code === GLib.KeyFileError.PARSE
        )
            return null;
        throw error;
    }
};
```

Checking a domain narrows the value to an error with `domain` and `code`. Check `error instanceof GLib.Error` when you need its native methods, such as `matches` or `copy`. As in GJS, `matches` accepts a generated domain in place of its quark, as in `error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)`. Editor completion lists a domain's codes from the generated bindings, and the library's documentation, such as GLib's [`GKeyFileError`](https://docs.gtk.org/glib/error.KeyFileError.html), says when each one occurs.

To report a failure to native code, create an error as in GJS. Throw it from a virtual function that reports errors through `GError` (see [Reporting a vfunc error](/v2/guide/subclassing#reporting-a-vfunc-error)), or pass it to a function such as `Gio.Task.returnError()`. The domain may be a generated domain or its quark, here and in `GLib.Error.newLiteral()`:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";

const reportMissingNote = (callback: Gio.AsyncReadyCallback) => {
    const task = Gio.Task.new(null, null, callback);
    task.returnError(
        new GLib.Error(
            Gio.IOErrorEnum,
            Gio.IOErrorEnum.NOT_FOUND,
            "No such note",
        ),
    );
};
```

## GLib criticals and warnings

Some native functions report misuse by logging a `CRITICAL` or `WARNING` instead of returning a `GError`. GTKX leaves these messages to GLib, as C and GJS applications do: GLib prints them to standard error, the binding call returns normally, and the application keeps running. A critical usually points at a programming error, such as an invalid argument, so fix the code that triggered it.

GLib's [`G_DEBUG`](https://docs.gtk.org/glib/running.html) environment variable can make criticals or warnings abort the process while you debug them. GLib `ERROR` messages always abort.

## Uncaught exceptions

GTKX keeps Node's contract for exceptions no JavaScript code catches. A function that native code calls, such as a signal handler, a draw function or a `GLib.timeoutAdd` callback, has no JavaScript caller to catch what it throws, so its exception becomes an uncaught exception. So does a render error no [error boundary](#react-error-boundaries) catches, and a promise rejection nothing handles. Node prints the error with its stack and ends the process with exit status 1, which closes the application and loses unsaved work. GJS logs such exceptions and keeps running; GTKX does not, so catch errors inside callbacks the application should survive, and show the failure through application state. A callback that reports errors through `GError`, such as some virtual functions, is different: GTKX hands the thrown error to its native caller.

Use Node's [`uncaughtExceptionMonitor`](https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor) to report crashes without changing that exit. An application that registers its own `uncaughtException` listener replaces the exit and keeps running, as any Node program does, although Node advises against resuming normal work after an uncaught exception.

`gtkx dev` behaves like the built application: it prints the error with a stack that points at your source, ends the application and keeps the dev server running, then starts the application again on the next save. Until then, [MCP](/v2/guide/mcp) tools answer with the error that stopped it. An application's own `uncaughtException` listener keeps it running under `gtkx dev` as well. `gtkx storybook` prints the error and keeps the explorer open.

## Addon panics

A panic in the GTKX native addon while it handles a binding call throws an ordinary `Error` from that call. It has no native domain or code.

A panic while native code calls back into JavaScript, or on another thread, cannot reach the `try`/`catch` that started the work. GTKX reports it as an [uncaught exception](#uncaught-exceptions), which ends the process unless the application handles it. Native state may already be invalid, so do not resume normal application work after a panic. An unhandled panic fails the test suite as well; see [Testing](/v2/guide/testing).

## React error boundaries

An error boundary can replace a failed descendant's rendered UI with a fallback. Use it around a recoverable part of the interface, and render the fallback with GTKX elements. React's [error boundary documentation](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) describes the component contract.

Boundaries do not catch ordinary event-handler failures or arbitrary rejected promises. Catch those failures in the signal handler or around the awaited operation, then update application state to show an error.
