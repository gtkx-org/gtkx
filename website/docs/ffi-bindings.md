# FFI Bindings

## Importing GTK/GLib Bindings

All GTK and GLib bindings are available through the `@gtkx/ffi` package. You can import entire libraries or specific functions and types as needed. For a full list of available bindings, see the [girs](https://github.com/gtkx/gtkx/tree/main/girs) directory in the GTKX repo.

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
```

## Async Methods

GTKX automatically transforms Gio.AsyncResult-based methods into Promise-based async methods. This allows you to use `async/await` syntax for idiomatic asynchronous code.

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

const dialog = new Gtk.FileDialog();
const file = await dialog.openAsync(window);
```

## Cancellation

Pass a `Gio.Cancellable` to cancel operations programmatically:

```tsx
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";

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
import * as Gio from "@gtkx/ffi/gio";

const gerror = error.gerror;

if (gerror.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.NOT_FOUND)) {
    console.log("The requested resource was not found.");
}
```
