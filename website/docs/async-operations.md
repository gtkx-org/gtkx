# Async Operations

This guide covers how GTKX handles asynchronous GTK operations, particularly the automatic Promise wrapping for GTK's async/finish pattern.

## Promise-Based GTK APIs

GTK4 uses an async/finish pattern for asynchronous operations: you call an `_async` method with a callback, then call the corresponding `_finish` method in that callback to get the result. GTKX automatically wraps these patterns into JavaScript Promises.

### File Dialogs

`Gtk.FileDialog` methods return Promises that resolve when the user selects a file:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gio from "@gtkx/ffi/gio";
import { NativeError } from "@gtkx/ffi";
import { useApplication } from "@gtkx/react";

const FileOperations = () => {
    const app = useApplication();

    const openFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");

        try {
            // Returns Promise<Gio.File>
            const file = await dialog.open(app.getActiveWindow() ?? undefined);
            const path = file.getPath();
            console.log("Selected:", path);
        } catch (error) {
            if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
                return; // User cancelled
            }
            throw error;
        }
    };

    const saveFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Save File");
        dialog.setInitialName("document.txt");

        try {
            // Returns Promise<Gio.File>
            const file = await dialog.save(app.getActiveWindow() ?? undefined);
            console.log("Save to:", file.getPath());
        } catch (error) {
            if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
                return;
            }
            throw error;
        }
    };

    const selectFolder = async () => {
        const dialog = new Gtk.FileDialog();

        try {
            // Returns Promise<Gio.File>
            const folder = await dialog.selectFolder(app.getActiveWindow() ?? undefined);
            console.log("Selected folder:", folder.getPath());
        } catch (error) {
            if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
                return;
            }
            throw error;
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkButton label="Open File" onClicked={openFile} />
            <GtkButton label="Save File" onClicked={saveFile} />
            <GtkButton label="Select Folder" onClicked={selectFolder} />
        </GtkBox>
    );
};
```

### Alert Dialogs

`Gtk.AlertDialog.choose()` returns a Promise resolving to the button index:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { NativeError } from "@gtkx/ffi";

const showConfirmation = async (window: Gtk.Window): Promise<boolean> => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Delete Item");
    dialog.setDetail("This action cannot be undone.");
    dialog.setButtons(["Cancel", "Delete"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
        // Returns Promise<number> (button index)
        const response = await dialog.choose(window);
        return response === 1;
    } catch (error) {
        if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
            return false;
        }
        throw error;
    }
};
```

### Color and Font Dialogs

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gdk from "@gtkx/ffi/gdk";
import { NativeError } from "@gtkx/ffi";

const pickColor = async (window: Gtk.Window): Promise<Gdk.RGBA | null> => {
    const dialog = new Gtk.ColorDialog();
    dialog.setModal(true);

    try {
        // Returns Promise<Gdk.RGBA>
        return await dialog.chooseRgba(window);
    } catch (error) {
        if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
            return null;
        }
        throw error;
    }
};

const pickFont = async (window: Gtk.Window): Promise<string | null> => {
    const dialog = new Gtk.FontDialog();

    try {
        // Returns Promise<Pango.FontDescription>
        const fontDesc = await dialog.chooseFont(window);
        return fontDesc?.toString() ?? null;
    } catch (error) {
        if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
            return null;
        }
        throw error;
    }
};
```

## Cancellable

GTK async operations accept a `Gio.Cancellable` parameter that allows you to cancel long-running operations:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gio from "@gtkx/ffi/gio";
import { NativeError } from "@gtkx/ffi";
import { useRef } from "react";

const CancellableDialog = () => {
    const app = useApplication();
    const cancellableRef = useRef<Gio.Cancellable | null>(null);

    const openWithTimeout = async () => {
        const dialog = new Gtk.FileDialog();
        const cancellable = new Gio.Cancellable();
        cancellableRef.current = cancellable;

        // Cancel after 30 seconds
        const timeoutId = setTimeout(() => {
            cancellable.cancel();
        }, 30000);

        try {
            const file = await dialog.open(app.getActiveWindow() ?? undefined, cancellable);
            clearTimeout(timeoutId);
            console.log("Selected:", file.getPath());
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof NativeError) {
                if (error.code === Gtk.DialogError.DISMISSED) {
                    console.log("Dialog cancelled");
                } else if (error.code === Gio.IOErrorEnum.CANCELLED) {
                    console.log("Operation timed out");
                }
            }
        }
    };

    const cancelOperation = () => {
        cancellableRef.current?.cancel();
    };

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            <GtkButton label="Open File (30s timeout)" onClicked={openWithTimeout} />
            <GtkButton label="Cancel" onClicked={cancelOperation} />
        </GtkBox>
    );
};
```

## Synchronous File Operations

For simple file operations, use synchronous Gio.File methods:

```tsx
import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
import { NativeError } from "@gtkx/ffi";

const readFile = (path: string): string | null => {
    const file = Gio.File.newForPath(path);

    try {
        const contents = { value: [] as number[] };
        file.loadContents(contents);
        return new TextDecoder().decode(new Uint8Array(contents.value));
    } catch (error) {
        if (error instanceof NativeError) {
            console.error(`Failed to read file: ${error.message}`);
        }
        return null;
    }
};

const writeFile = (path: string, content: string): boolean => {
    const file = Gio.File.newForPath(path);
    const bytes = new TextEncoder().encode(content);

    try {
        file.replaceContents(
            Array.from(bytes),
            bytes.length,
            false, // makeBackup
            Gio.FileCreateFlags.REPLACE_DESTINATION,
        );
        return true;
    } catch (error) {
        if (error instanceof NativeError) {
            console.error(`Failed to write file: ${error.message}`);
        }
        return false;
    }
};
```

## Error Handling

All GTKX async operations throw `NativeError` on failure. See [Error Handling](./error-handling.md) for details.

Common error patterns:

```tsx
import { NativeError } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Gio from "@gtkx/ffi/gio";

const handleAsyncError = (error: unknown, operation: string) => {
    if (!(error instanceof NativeError)) {
        console.error(`${operation}: Unknown error`, error);
        return;
    }

    switch (error.code) {
        case Gtk.DialogError.DISMISSED:
            // User cancelled - usually not worth logging
            break;
        case Gio.IOErrorEnum.CANCELLED:
            console.log(`${operation}: Cancelled by application`);
            break;
        case Gio.IOErrorEnum.NOT_FOUND:
            console.error(`${operation}: File not found`);
            break;
        case Gio.IOErrorEnum.PERMISSION_DENIED:
            console.error(`${operation}: Permission denied`);
            break;
        default:
            console.error(`${operation}: ${error.message}`);
    }
};
```

## Available Promise-Based APIs

GTKX provides Promise wrappers for these GTK async operations:

| Class | Methods |
|-------|---------|
| `Gtk.FileDialog` | `open`, `openMultiple`, `save`, `selectFolder`, `selectMultipleFolders` |
| `Gtk.ColorDialog` | `chooseRgba`, `chooseRgbaAndWait` |
| `Gtk.FontDialog` | `chooseFont`, `chooseFace`, `chooseFontAndFeatures` |
| `Gtk.AlertDialog` | `choose` |
| `Gtk.PrintDialog` | `print`, `printFile`, `setup` |
| `Gtk.UriLauncher` | `launch` |
| `Gtk.FileLauncher` | `launch`, `openContainingFolder` |
| `Adw.AlertDialog` | `choose` |
| `Adw.MessageDialog` | `choose` |

All these methods return JavaScript Promises that resolve with the operation result or reject with a `NativeError`.
