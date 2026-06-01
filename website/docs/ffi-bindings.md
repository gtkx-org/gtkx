# FFI Bindings

## Importing GTK/GLib Bindings

All GTK and GLib bindings are available through the `@gtkx/gi` package. You can import entire libraries or specific functions and types as needed. For a full list of available bindings, see the [girs](https://github.com/gtkx/gtkx/tree/main/girs) directory in the GTKX repo.

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
```

## Running an Application

The GLib main loop runs on a dedicated thread that starts as soon as `@gtkx/ffi` is loaded, so a plain (non-React) application keeps the loop alive without you running it yourself. Drive the application through `register` and `activate` and build your widgets in the `activate` handler:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const app = new Gtk.Application({
    applicationId: "com.example.myapp",
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

app.on("activate", () => {
    const window = new Gtk.ApplicationWindow({ application: app, title: "Hello" });
    window.present();
});

app.register(null);
app.activate();
```

Do **not** call `Gio.Application.run`: it blocks the JavaScript thread for the lifetime of the application, which prevents Node.js from servicing timers, promises, and — most importantly — signal handlers.

`SIGINT` (Ctrl+C), `SIGTERM`, and `SIGHUP` are handled automatically: the runtime routes the signal through {@link stop} to quit the main loop and drain finalizers before exiting with the signal's conventional code. To shut down from code, call `stop()` directly. Embedders that own process signals can suppress the handlers by setting `GTKX_DISABLE_SHUTDOWN_HANDLERS=1`.

## Async Methods

GTKX automatically transforms Gio.AsyncResult-based methods into Promise-based async methods. This allows you to use `async/await` syntax for idiomatic asynchronous code.

```tsx
import * as Gtk from "@gtkx/gi/gtk";

const dialog = new Gtk.FileDialog();
const file = await dialog.openAsync(window);
```

## Cancellation

Pass a `Gio.Cancellable` to cancel operations programmatically:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const cancellable = new Gio.Cancellable();

// Cancel after timeout
setTimeout(() => cancellable.cancel(), 30000);

try {
    const dialog = new Gtk.FileDialog();
    const file = await dialog.openAsync(window, cancellable);
} catch (error) {
    if (error instanceof NativeError && error.code === Gio.IOErrorEnum.CANCELLED) {
        console.log("Operation was canceled");
    }
}
```

## Error Handling

When fallible GLib operations output an error, GTKX throws a `NativeError` that wraps the underlying `GError`:

```tsx
import { NativeError } from "@gtkx/ffi";

try {
    await someGtkOperationThatThrows();
} catch (error) {
    if (error instanceof NativeError) {
        console.log(`Error: ${error.message}`);
        console.log(`Domain: ${error.getDomain()}`);
        console.log(`Code: ${error.getCode()}`);
    }
}
```

### Accessing the Raw GError

The `NativeError` class also provides access to the underlying `GError` struct for advanced use cases:

```tsx
import * as Gio from "@gtkx/gi/gio";

const gerror = error.gerror;

if (gerror.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.NOT_FOUND)) {
    console.log("The requested resource was not found.");
}
```
