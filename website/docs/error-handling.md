---
sidebar_position: 10
---

# Error Handling

GTKX exposes GTK's error system (GError) through JavaScript exceptions. When GTK operations fail, they throw `NativeError` instances.

## NativeError

The `NativeError` class wraps GLib's GError structure:

```tsx
import { NativeError } from '@gtkx/ffi';

try {
    const file = await dialog.open(window);
} catch (error) {
    if (error instanceof NativeError) {
        console.log('Message:', error.message);
        console.log('Domain:', error.domain);
        console.log('Code:', error.code);
    }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error description |
| `domain` | `number` | Error domain (quark identifier) |
| `code` | `number` | Error code within the domain |

## GError Structure

GTK uses a domain/code system for categorizing errors:

- **Domain**: A quark (integer) identifying the error category (e.g., file errors, GTK errors)
- **Code**: An integer identifying the specific error within that domain
- **Message**: Human-readable description

```tsx
if (error instanceof NativeError) {
    if (error.domain === Gtk.DialogError.quark()) {
        if (error.code === Gtk.DialogError.DISMISSED) {
            console.log('Dialog was dismissed by user');
        }
    }
}
```

## Common Error Patterns

### Dialog Dismissal

When a user cancels or dismisses a dialog:

```tsx
try {
    const file = await dialog.open(window);
    processFile(file);
} catch (error) {
    if (error instanceof NativeError) {
        if (error.code === Gtk.DialogError.DISMISSED) {
            return;
        }
        console.error('Dialog error:', error.message);
    }
    throw error;
}
```

### File Operations

File I/O errors from GIO:

```tsx
try {
    const contents = await file.loadContentsAsync(null);
} catch (error) {
    if (error instanceof NativeError) {
        console.error('File error:', error.message);
    }
}
```

### Async Callbacks

Errors in async operations are caught and converted to Promise rejections:

```tsx
const dialog = new Gtk.FileDialog();

try {
    const file = await dialog.open(window);
} catch (error) {
    if (error instanceof NativeError) {
        handleNativeError(error);
    } else {
        handleUnexpectedError(error);
    }
}
```

## Error Domains

Common GTK/GLib error domains:

| Domain | Description |
|--------|-------------|
| `Gtk.DialogError` | Dialog operations (dismissed, failed) |
| `Gio.IOErrorEnum` | File I/O operations |
| `Gio.ResolverError` | DNS resolution |
| `GLib.FileError` | Low-level file operations |

### Checking Domains

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import * as Gio from '@gtkx/ffi/gio';

if (error instanceof NativeError) {
    if (error.domain === Gtk.DialogError.quark()) {
        handleDialogError(error);
    } else if (error.domain === Gio.IOErrorEnum.quark()) {
        handleIOError(error);
    }
}
```

## FFI Layer Errors

Beyond GErrors, the FFI layer can throw errors for:

### Symbol Errors

When calling a function that doesn't exist:

```tsx
try {
    call('libgtk-4.so.1', 'nonexistent_function', [], 'void');
} catch (error) {
    console.error('Symbol not found');
}
```

### Library Errors

When a library can't be loaded:

```tsx
try {
    call('libnonexistent.so', 'some_function', [], 'void');
} catch (error) {
    console.error('Library not found');
}
```

### Type Errors

When passing incorrect types to FFI calls:

```tsx
try {
    call('libgtk-4.so.1', 'gtk_widget_show', [
        { type: { type: 'string' }, value: 'not a widget' }
    ], 'void');
} catch (error) {
    console.error('Type error in FFI call');
}
```

## Best Practices

### Always Catch Async Errors

Async GTK operations can fail or be cancelled:

```tsx
const showFileDialog = async () => {
    try {
        const file = await dialog.open(window);
        return file;
    } catch (error) {
        if (error instanceof NativeError) {
            if (error.code === Gtk.DialogError.DISMISSED) {
                return null;
            }
        }
        throw error;
    }
};
```

### Provide User Feedback

Translate errors to user-friendly messages:

```tsx
const saveDocument = async () => {
    try {
        await file.replaceContentsAsync(contents, null, false, Gio.FileCreateFlags.NONE, null);
        showToast('Document saved');
    } catch (error) {
        if (error instanceof NativeError) {
            showToast(`Failed to save: ${error.message}`);
        }
    }
};
```

### Log for Debugging

Include error details in logs:

```tsx
catch (error) {
    if (error instanceof NativeError) {
        console.error('Native error:', {
            message: error.message,
            domain: error.domain,
            code: error.code,
            stack: error.stack
        });
    }
}
```

### Type Guard

Create a type guard for cleaner error handling:

```tsx
function isNativeError(error: unknown): error is NativeError {
    return error instanceof NativeError;
}

try {
    await riskyOperation();
} catch (error) {
    if (isNativeError(error)) {
        handleNativeError(error);
    } else if (error instanceof Error) {
        handleJSError(error);
    } else {
        handleUnknown(error);
    }
}
```

## Error Recovery

Some errors are recoverable:

```tsx
const openOrCreate = async (path: string) => {
    const file = Gio.File.newForPath(path);

    try {
        const [contents] = await file.loadContentsAsync(null);
        return contents;
    } catch (error) {
        if (isNativeError(error) && error.code === Gio.IOErrorEnum.NOT_FOUND) {
            await file.create(Gio.FileCreateFlags.NONE, null);
            return new Uint8Array();
        }
        throw error;
    }
};
```
