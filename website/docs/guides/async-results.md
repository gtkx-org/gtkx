---
sidebar_position: 7
---

# Async Results

This guide explains how asynchronous operations work in GTKX, including the Promise-based API for GTK methods that use GLib's async pattern.

## Overview

Many GTK4 operations are asynchronous, especially those involving:

- **File dialogs** - Opening, saving, and selecting files
- **File I/O** - Reading and writing files
- **Network operations** - HTTP requests, socket connections
- **Long-running tasks** - Operations that shouldn't block the UI

GTKX automatically wraps GTK's callback-based async pattern into modern JavaScript Promises, allowing you to use `async/await` syntax.

## How It Works

### GTK's Async Pattern

In GTK/GLib, asynchronous operations follow a pattern with two methods:

1. **Start method** - Begins the operation and takes a callback (e.g., `open()`)
2. **Finish method** - Completes the operation and returns the result (e.g., `open_finish()`)

```c
// C API pattern
gtk_file_dialog_open(dialog, parent, cancellable, callback, user_data);
// ... later in callback ...
GFile *file = gtk_file_dialog_open_finish(dialog, result, &error);
```

### GTKX Promise Wrapper

GTKX automatically detects methods following this pattern and generates a single Promise-based method:

```tsx
// GTKX Promise API
const file = await dialog.open();
```

The generated code:
1. Creates a Promise
2. Calls the async method with a callback
3. In the callback, calls the finish method
4. Resolves or rejects the Promise based on the result

## Using Async Methods

### Basic Usage

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

const openFile = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open File");

    try {
        const file = await dialog.open();
        const path = file.getPath();
        console.log(`Opened: ${path}`);
    } catch (error) {
        console.log("Operation cancelled or failed");
    }
};
```

### Error Handling

Async methods throw errors in two cases:

1. **User cancellation** - The user cancelled the operation (e.g., closed a dialog)
2. **Operation failure** - The underlying operation failed

```tsx
import { NativeError } from "@gtkx/ffi";

try {
    const file = await dialog.open();
    // Success
} catch (error) {
    if (error instanceof NativeError) {
        // GTK/GLib error
        console.error(`Error: ${error.message}`);
        console.error(`Domain: ${error.domain}, Code: ${error.code}`);
    } else {
        // User cancelled or other error
        console.log("Operation cancelled");
    }
}
```

### Available Async Methods

Here are commonly used async methods in GTKX:

#### FileDialog

| Method | Returns | Description |
|--------|---------|-------------|
| `open()` | `Gio.File` | Open a single file |
| `openMultiple()` | `Gio.ListModel` | Open multiple files |
| `save()` | `Gio.File` | Choose save location |
| `selectFolder()` | `Gio.File` | Select a folder |
| `selectMultipleFolders()` | `Gio.ListModel` | Select multiple folders |

#### ColorDialog

| Method | Returns | Description |
|--------|---------|-------------|
| `chooseRgba()` | `Gdk.RGBA` | Choose a color with alpha |

#### FontDialog

| Method | Returns | Description |
|--------|---------|-------------|
| `chooseFont()` | `Pango.FontDescription` | Choose a font |
| `chooseFamily()` | `Pango.FontFamily` | Choose a font family |
| `chooseFace()` | `Pango.FontFace` | Choose a font face |

#### AlertDialog

| Method | Returns | Description |
|--------|---------|-------------|
| `choose()` | `number` | Show dialog, returns button index |

## Working with Results

### File Objects

When you get a `Gio.File` from a dialog, you can call methods on it:

```tsx
const file = await dialog.open();

// Get the file path
const path = file.getPath();

// Get the URI
const uri = file.getUri();

// Get the basename (filename without directory)
const basename = file.getBasename();

// Get the parent directory
const parent = file.getParent();
```

### RGBA Colors

The `Gdk.RGBA` struct contains color components as floats (0.0 to 1.0):

```tsx
const rgba = await colorDialog.chooseRgba();

// Access color components (0.0 - 1.0)
console.log(rgba.red, rgba.green, rgba.blue, rgba.alpha);

// Convert to 0-255 range
const r = Math.round(rgba.red * 255);
const g = Math.round(rgba.green * 255);
const b = Math.round(rgba.blue * 255);

// Create CSS color string
const cssColor = `rgba(${r}, ${g}, ${b}, ${rgba.alpha})`;
```

### Font Descriptions

Font information comes as a `Pango.FontDescription`:

```tsx
const fontDesc = await fontDialog.chooseFont();

// Get font family name
const family = fontDesc.getFamily();

// Get font size (in Pango units, divide by 1024 for points)
const sizeInPoints = fontDesc.getSize() / 1024;

// Get font weight, style, etc.
const weight = fontDesc.getWeight();
const style = fontDesc.getStyle();
```

## Integrating with React State

### Simple Pattern

```tsx
const [selectedPath, setSelectedPath] = useState<string | null>(null);

const handleOpen = async () => {
    const dialog = new Gtk.FileDialog();
    try {
        const file = await dialog.open();
        setSelectedPath(file.getPath());
    } catch {
        // User cancelled
    }
};
```

### With Loading State

```tsx
const [loading, setLoading] = useState(false);
const [result, setResult] = useState<string | null>(null);

const handleOpen = async () => {
    setLoading(true);
    try {
        const dialog = new Gtk.FileDialog();
        const file = await dialog.open();
        setResult(file.getPath());
    } catch {
        // User cancelled
    } finally {
        setLoading(false);
    }
};

return (
    <Box>
        <Button
            label={loading ? "Opening..." : "Open File"}
            onClicked={handleOpen}
            sensitive={!loading}
        />
        {result && <Label.Root label={result} />}
    </Box>
);
```

### Multiple Concurrent Operations

```tsx
const [results, setResults] = useState<string[]>([]);

const handleOpenMultiple = async () => {
    const promises = [
        openFileDialog("Select first file"),
        openFileDialog("Select second file"),
    ];

    const files = await Promise.allSettled(promises);
    const paths = files
        .filter((r): r is PromiseFulfilledResult<Gio.File> => r.status === "fulfilled")
        .map(r => r.value.getPath());

    setResults(paths);
};

const openFileDialog = async (title: string) => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle(title);
    return dialog.open();
};
```

## Advanced Topics

### Cancellation

GTK async operations support cancellation through `Gio.Cancellable`. While GTKX doesn't expose this directly in the Promise API, cancellation happens automatically when:

- The user closes a dialog
- The parent window is destroyed
- The application is shutting down

### Sequential vs Parallel

For independent operations, use parallel execution:

```tsx
// Parallel - faster
const [file1, file2] = await Promise.all([
    dialog1.open(),
    dialog2.open(),
]);
```

For dependent operations, use sequential execution:

```tsx
// Sequential - when order matters
const folder = await folderDialog.selectFolder();
const file = await fileDialog.open(); // Could use folder as initial location
```

### Error Recovery

Handle errors gracefully and provide retry options:

```tsx
const openWithRetry = async (maxRetries = 3): Promise<Gio.File | null> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const dialog = new Gtk.FileDialog();
            return await dialog.open();
        } catch {
            // User cancelled, no retry needed
            return null;
        }
    }
    return null;
};
```

## Best Practices

### Always Use try/catch

Async methods can throw, always handle errors:

```tsx
// ✓ Good
try {
    const file = await dialog.open();
} catch {
    // Handle cancellation/error
}

// ✗ Bad - unhandled rejection
const file = await dialog.open();
```

### Don't Block the UI

Async operations don't block the GTK main loop, but avoid creating many dialogs simultaneously:

```tsx
// ✓ Good - one dialog at a time
const file = await dialog.open();

// ✗ Bad - multiple dialogs fight for focus
await Promise.all([dialog1.open(), dialog2.open(), dialog3.open()]);
```

### Clean Up Resources

If you need to clean up after an operation, use finally:

```tsx
let cleanup: (() => void) | null = null;

try {
    cleanup = prepareOperation();
    const result = await asyncOperation();
    processResult(result);
} finally {
    cleanup?.();
}
```

## See Also

- [Working with Dialogs](./dialogs.md) - Dialog-specific examples
- [Error Handling](./error-handling.md) - Handling native errors
