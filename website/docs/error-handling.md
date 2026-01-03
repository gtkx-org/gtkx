# Error Handling

When GTK or GLib operations fail, GTKX throws a `NativeError` that wraps the underlying `GError`.

## NativeError

```tsx
import { NativeError } from "@gtkx/ffi";

try {
    await someGtkOperation();
} catch (error) {
    if (error instanceof NativeError) {
        console.log(`Error: ${error.message}`);
        console.log(`Code: ${error.code}`);
    }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message |
| `domain` | `number` | GLib error domain (quark) |
| `code` | `number` | Error code within the domain |

### Common Error Codes

Check `error.code` against these enums:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gio from "@gtkx/ffi/gio";

// Dialog errors
Gtk.DialogError.DISMISSED   // User cancelled dialog

// I/O errors
Gio.IOErrorEnum.NOT_FOUND        // File not found
Gio.IOErrorEnum.PERMISSION_DENIED // Permission denied
Gio.IOErrorEnum.CANCELLED        // Operation cancelled via Cancellable
```

## Handling Dialog Cancellation

Dialogs throw `NativeError` when the user cancels. This is expected behavior:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { NativeError } from "@gtkx/ffi";

const pickFile = async (window: Gtk.Window) => {
    try {
        return await new Gtk.FileDialog().open(window);
    } catch (error) {
        if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
            return null; // User cancelled - not an error
        }
        throw error; // Actual error
    }
};
```

See [Async Operations](./async-operations.md) for more dialog examples.

## Distinguishing Error Types

Use `instanceof` to distinguish GTKX native errors from JavaScript errors:

```tsx
import { NativeError } from "@gtkx/ffi";

const handleError = (error: unknown) => {
    if (error instanceof NativeError) {
        // Error from GTK/GLib
        console.log(`Native: [${error.code}] ${error.message}`);
    } else if (error instanceof Error) {
        // Regular JavaScript error
        console.log(`JS: ${error.message}`);
    }
};
```

## Best Practices

1. **Check for `NativeError`** — Use `instanceof NativeError` to identify GTK/GLib errors
2. **Handle dismissal gracefully** — Dialog cancellation is expected; check for `Gtk.DialogError.DISMISSED`
3. **Use error codes** — Check `error.code` against enum values for specific handling
4. **Don't swallow errors** — Log errors to aid debugging
