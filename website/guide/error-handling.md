---
title: "Error Handling"
description: "Match GLib errors and handle failures outside a call stack."
---

# Error Handling

Failed GI calls throw and promisified calls reject. No `GError**` parameter appears in JavaScript signatures.

## Match a GLib error

Each generated error domain works with `instanceof`; combine it with the domain's code:

```ts
import * as GLib from "@gtkx/gi/glib";

try {
    GLib.KeyFile.new().loadFromData("invalid", 7, GLib.KeyFileFlags.NONE);
} catch (error) {
    if (!(error instanceof GLib.KeyFileError && error.code === GLib.KeyFileError.PARSE)) throw error;
}
```

Domain objects include `GLib.KeyFileError`, `Gio.IOErrorEnum`, and `Gtk.DialogError`. A domain check narrows to `domain`, `code`, and `message`; check `error instanceof GLib.Error` when you need `GLib.Error` methods.

## Handle failures outside a call

A GLib `CRITICAL`, GLib `ERROR`, or native-addon panic has no JavaScript call to throw from. GTKX raises it through Node's `uncaughtException` channel. Without a handler, Node reports it and exits nonzero:

```ts
process.on("uncaughtException", (error) => {
    reportToYourCrashService(error);
    process.exit(1);
});
```

Warnings and lower-severity GLib logs continue to stderr. This channel cannot be redirected into a local `try`/`catch` or disabled. In tests, a critical or panic fails the active test.

See [Async Operations](/guide/async-operations) for cancellation and [Testing](/guide/testing) for integration-test behavior.
