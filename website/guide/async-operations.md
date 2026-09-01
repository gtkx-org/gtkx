---
title: "Async Operations"
description: "Await GIO calls, cancel work, and keep the UI responsive."
---

# Async Operations

Generated GIO async methods return promises. They resolve to the finish method's useful value, or a tuple when there are several, and reject with the corresponding GLib error.

## Await a native operation

GTK reports a dismissed dialog as an error, so match its domain and code:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";

const OpenButton = ({ onFile }: { onFile: (file: Gio.File) => void }) => {
    const parent = useParentWindow();

    const open = async () => {
        try {
            onFile(await new Gtk.FileDialog().open(parent, null));
        } catch (error) {
            if (error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED) return;
            throw error;
        }
    };

    return <GtkButton iconName="document-open-symbolic" onClicked={() => void open()} />;
};
```

Promisified methods accept an optional `Gio.Cancellable` last. Calling `cancel()` rejects the promise with the operation's cancellation domain and code; release timers or listeners in `finally`.

## Move CPU work off the UI thread

CPU-bound JavaScript freezes GTK because widget work and JavaScript share the main thread. Use a [Node worker thread](https://nodejs.org/api/worker_threads.html):

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./indexer.ts", import.meta.url));
worker.on("message", (rows) => setRows(rows));
```

The relative worker source URL must appear directly in `new Worker(...)` so `gtkx build` can find and bundle it. Workers compute data; they do not call GTK. Continue with [Error Handling](/guide/error-handling).
