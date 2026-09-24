---
title: "Error Handling"
description: "Match native errors by domain and code, and distinguish call failures from fatal errors."
---

# Error Handling

GTKX turns a native `GError` into a thrown `GLib.Error`, which extends JavaScript's `Error`. Generated signatures omit the error output parameter. Promisified methods reject with the same errors; see [Async Operations](/guide/async-operations).

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

## Fatal errors

Some failures have no `GError` channel. GLib `CRITICAL` and `ERROR` records, and GTKX addon panics, reach Node's uncaught-exception channel instead. This includes reports sent from another thread, and they cannot be caught around the binding call that triggered them.

Use Node's [`uncaughtExceptionMonitor`](https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor) for synchronous crash reporting while preserving its default process exit. Native state may already be invalid; do not resume normal application work after a fatal error.

GLib `ERROR` messages are reported before GLib aborts. Lower log levels retain GLib's normal logging behavior. Unhandled failures also fail the test suite; see [Testing](/guide/testing).

## Next

Continue with [Components](/guide/components) for how GTKX widgets compose and the hooks that drive them.
