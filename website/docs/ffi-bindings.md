# FFI bindings

## Importing GTK/GLib bindings

All GTK and GLib bindings are available through the `@gtkx/gi` package. You can import entire libraries or specific functions and types as needed. The available namespaces are generated from the GIR libraries you declare in `gtkx.config.ts`; each library becomes a submodule of `@gtkx/gi` (`@gtkx/gi/gtk`, `@gtkx/gi/gio`, `@gtkx/gi/glib`, `@gtkx/gi/adw`, and so on).

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
```

## Running an application

The GLib main loop runs on a dedicated thread that starts as soon as `@gtkx/ffi` is loaded, so a plain (non-React) application keeps the loop alive without you running it yourself. Drive the application through `register` and `activate` and build your widgets in the `activate` handler:

```tsx
import { stop } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const app = new Gtk.Application({
    applicationId: "com.example.myapp",
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

app.on("activate", () => {
    const window = new Gtk.ApplicationWindow({ application: app, title: "Hello" });
    window.on("close-request", () => {
        void stop();
        return false;
    });
    window.present();
});

app.register(null);
app.activate();
```

Do **not** call `Gio.Application.run`: it blocks the JavaScript thread for the lifetime of the application, which prevents Node.js from servicing timers, promises, and — most importantly — signal handlers.

`SIGINT` (Ctrl+C), `SIGTERM`, and `SIGHUP` are handled automatically: the runtime routes the signal through `stop` to quit the main loop and drain finalizers before exiting with the signal's conventional code. To shut down from code, import `stop` from `@gtkx/ffi` and call `stop()` directly. Embedders that own process signals can suppress the handlers by setting `GTKX_DISABLE_SHUTDOWN_HANDLERS=1`.

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
