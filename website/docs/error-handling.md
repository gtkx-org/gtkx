# Error Handling

This guide covers GTKX-specific error handling patterns, particularly how GTK/GLib errors are exposed in JavaScript.

## NativeError

When GTK or GLib operations fail, GTKX throws a `NativeError` that wraps the underlying `GError`. This class provides access to the error domain, code, and message from the native error.

```tsx
import { NativeError } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";

const loadFile = async (path: string) => {
    const file = Gio.File.newForPath(path);

    try {
        const [contents] = await file.loadContentsAsync(null);
        return new TextDecoder().decode(contents);
    } catch (error) {
        if (error instanceof NativeError) {
            console.log(`GLib error: domain=${error.domain}, code=${error.code}`);
            console.log(`Message: ${error.message}`);
        }
        throw error;
    }
};
```

### NativeError Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message from GLib |
| `domain` | `number` | GLib error domain (quark) identifying the error category |
| `code` | `number` | Error code within the domain |

### Common Error Domains

GLib uses error domains to categorize errors. Common domains include:

- **`Gio.IOErrorEnum`** — File I/O errors (file not found, permission denied, etc.)
- **`Gtk.DialogError`** — Dialog-related errors (dismissed, etc.)

```tsx
import { NativeError } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";

try {
    const file = Gio.File.newForPath("/nonexistent/path");
    await file.loadContentsAsync(null);
} catch (error) {
    if (error instanceof NativeError) {
        // Check for specific error codes
        if (error.code === Gio.IOErrorEnum.NOT_FOUND) {
            console.log("File not found");
        } else if (error.code === Gio.IOErrorEnum.PERMISSION_DENIED) {
            console.log("Permission denied");
        }
    }
}
```

## Dialog Dismissal

GTK dialogs throw errors when dismissed or cancelled. This is expected behavior, not a failure.

### File Dialogs

`Gtk.FileDialog` methods (`open`, `save`, `selectFolder`) throw when the user cancels:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { NativeError } from "@gtkx/ffi";
import { useApplication } from "@gtkx/react";

const FileOpener = () => {
    const app = useApplication();

    const openFile = async () => {
        const dialog = new Gtk.FileDialog();

        try {
            const file = await dialog.open(app.getActiveWindow() ?? undefined);
            const path = file.getPath();
            if (path) {
                processFile(path);
            }
        } catch (error) {
            if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
                // User cancelled - this is expected, not an error
                return;
            }
            // Actual error - rethrow or handle
            throw error;
        }
    };

    return <GtkButton label="Open File" onClicked={openFile} />;
};
```

### Alert Dialogs

`Gtk.AlertDialog.choose()` also throws on dismissal:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { NativeError } from "@gtkx/ffi";

const showConfirmation = async (window: Gtk.Window): Promise<boolean> => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setButtons(["Cancel", "OK"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
        const response = await dialog.choose(window);
        return response === 1; // OK button
    } catch (error) {
        if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
            return false; // Treated as cancel
        }
        throw error;
    }
};
```

## Async Operation Errors

GTKX wraps GTK's async/finish pattern into JavaScript Promises. When the underlying operation fails, the Promise rejects with a `NativeError`.

```tsx
import * as Gio from "@gtkx/ffi/gio";
import { NativeError } from "@gtkx/ffi";

const readFileWithRetry = async (path: string, retries = 3): Promise<string> => {
    const file = Gio.File.newForPath(path);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const [contents] = await file.loadContentsAsync(null);
            return new TextDecoder().decode(contents);
        } catch (error) {
            if (error instanceof NativeError) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);

                if (error.code === Gio.IOErrorEnum.NOT_FOUND) {
                    throw error; // Don't retry for missing files
                }

                if (attempt === retries) {
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }

    throw new Error("Unreachable");
};
```

## Error Propagation from Signals

Errors thrown in signal handlers propagate normally:

```tsx
const RiskyButton = () => {
    const handleClick = () => {
        try {
            const result = someFfiOperation();
            // Use result
        } catch (error) {
            if (error instanceof NativeError) {
                console.error(`Native error: ${error.message}`);
            }
            // Handle or display error to user
        }
    };

    return <GtkButton label="Do Something" onClicked={handleClick} />;
};
```

## Distinguishing Error Types

Use `instanceof` to distinguish between GTKX native errors and regular JavaScript errors:

```tsx
import { NativeError } from "@gtkx/ffi";

const handleError = (error: unknown) => {
    if (error instanceof NativeError) {
        // Error from GTK/GLib
        console.log(`Native error [${error.domain}:${error.code}]: ${error.message}`);
    } else if (error instanceof Error) {
        // Regular JavaScript error
        console.log(`JS error: ${error.message}`);
    } else {
        console.log("Unknown error:", error);
    }
};
```

## Best Practices

1. **Check for `NativeError`** — Use `instanceof NativeError` to identify GTK/GLib errors
2. **Handle dismissal gracefully** — Dialog cancellation is expected; check for `Gtk.DialogError.DISMISSED`
3. **Use error codes** — Check `error.code` against GLib enum values for specific error handling
4. **Don't swallow errors** — At minimum, log errors to aid debugging
5. **Provide user feedback** — Use toasts or dialogs to inform users of failures
