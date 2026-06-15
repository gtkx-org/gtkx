# FFI bindings

## Importing GTK/GLib bindings

All GTK and GLib bindings are available through the `@gtkx/gi` package. You can import entire libraries or specific functions and types as needed. The available namespaces are generated from the GIR libraries you declare in `gtkx.config.ts`; each library becomes a submodule of `@gtkx/gi` (`@gtkx/gi/gtk`, `@gtkx/gi/gio`, `@gtkx/gi/glib`, `@gtkx/gi/adw`, and so on).

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
```

## Running an application

The GLib main loop runs on a dedicated thread that starts as soon as `@gtkx/ffi` is loaded, but importing `@gtkx/ffi` does not, on its own, keep the process alive — a Node.js process that never runs an application exits cleanly once its work is done. Build your widgets in the `activate` handler and call `runApplication` to run the application (the equivalent of `Gio.Application.run`): it registers and activates the application, then holds the process alive until the application shuts down.

```tsx
import { quitApplication, runApplication } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const app = new Gtk.Application({
    applicationId: "com.example.myapp",
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

app.on("activate", () => {
    const window = new Gtk.ApplicationWindow({ application: app, title: "Hello" });
    window.on("close-request", () => {
        quitApplication(app);
        return false;
    });
    window.present();
});

runApplication(app);
```

Do **not** call `Gio.Application.run`: it blocks the JavaScript thread for the lifetime of the application, which prevents Node.js from servicing timers, promises, and — most importantly — signal handlers. `runApplication` keeps the process alive without blocking.

`runApplication` holds the process alive from the application's `activate` signal until its `shutdown` signal; `quitApplication(app)` emits `shutdown`, releasing the hold so the process exits cleanly once nothing else keeps the loop busy. `@gtkx/ffi` itself installs no signal handlers: a standalone application that wants `SIGINT` (Ctrl+C) to shut down cleanly installs its own handler — for example with `installGracefulShutdown` from `@gtkx/utils` — that calls `quitApplication(app)`. The `gtkx dev` server installs such a handler for you. To run code during shutdown — before native dispatch tears down — register a callback with `onExit`.

## Async methods

GTKX automatically transforms `Gio.AsyncResult`-based methods into Promise-based async methods. This lets you use `async`/`await` syntax for idiomatic asynchronous code.

```tsx
import * as Gtk from "@gtkx/gi/gtk";

const dialog = new Gtk.FileDialog();
const file = await dialog.open(parent);
```

## Cancellation

Pass a `Gio.Cancellable` to cancel operations programmatically:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const cancellable = new Gio.Cancellable();

setTimeout(() => cancellable.cancel(), 30000);

try {
    const dialog = new Gtk.FileDialog();
    const file = await dialog.open(parent, cancellable);
} catch (error) {
    if (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED) {
        console.log("Operation was canceled");
    }
}
```

## Error handling

When a fallible GLib operation fails, GTKX throws the underlying `GError` directly. Read its `message`, `domain`, and `code`, and discriminate it against a generated error-domain enum with `instanceof`:

```tsx
import * as Gio from "@gtkx/gi/gio";

try {
    await someGtkOperationThatThrows();
} catch (error) {
    if (error instanceof Gio.IOErrorEnum) {
        console.log(`Message: ${error.message}`);
        console.log(`Domain: ${error.domain}`);
        console.log(`Code: ${error.code}`);
    }
}
```

### Matching a specific error

Compare `code` against the error-domain enum's members to handle a particular failure:

```tsx
import * as Gio from "@gtkx/gi/gio";

try {
    await someGtkOperationThatThrows();
} catch (error) {
    if (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.NOT_FOUND) {
        console.log("The requested resource was not found.");
    }
}
```
