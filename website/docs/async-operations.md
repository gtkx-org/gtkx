# Async Operations

GTKX automatically transforms GTK's callback-based async/finish pattern into JavaScript Promises, letting you use `async`/`await` with all GTK async operations.

## What GTKX Does

GTK4 uses callbacks for async operations. GTKX wraps these into Promises:

```tsx
// Without GTKX (raw GTK pattern):
// dialog.open_async(window, null, (dialog, result) => {
// const file = dialog.open_finish(result);
// });

// With GTKX:
const file = await dialog.openAsync(window);
```

## Usage Pattern

All async operations follow the same pattern—`await` the method and handle `NativeError` for cancellation:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { NativeError } from "@gtkx/ffi";
import { GtkButton, useApplication } from "@gtkx/react";

const FilePickerButton = () => {
 const app = useApplication();

 const pickFile = async () => {
 const dialog = new Gtk.FileDialog();

 try {
 const file = await dialog.openAsync(app.getActiveWindow() ?? undefined);
 console.log("Selected:", file.getPath());
 } catch (error) {
 if (error instanceof NativeError && error.code === Gtk.DialogError.DISMISSED) {
 return; // User cancelled
 }
 throw error;
 }
 };

 return <GtkButton label="Open File" onClicked={() => pickFile()} />;
};
```

The same pattern works for all dialog types:

```tsx
// Alert dialog - returns button index
const response = await new Gtk.AlertDialog().chooseAsync(window);

// Color dialog - returns Gdk.RGBA
const color = await new Gtk.ColorDialog().chooseRgbaAsync(window);

// Font dialog - returns Pango.FontDescription
const font = await new Gtk.FontDialog().chooseFontAsync(window);
```

## Cancellation

Pass a `Gio.Cancellable` to cancel operations programmatically:

```tsx
import * as Gio from "@gtkx/ffi/gio";

const cancellable = new Gio.Cancellable();

// Cancel after timeout
setTimeout(() => cancellable.cancel(), 30000);

try {
 const file = await dialog.openAsync(window, cancellable);
} catch (error) {
 if (error instanceof NativeError && error.code === Gio.IOErrorEnum.CANCELLED) {
 console.log("Operation was cancelled");
 }
}
```

## Error Handling

All GTKX async operations throw `NativeError` on failure. The `code` property contains the GTK/GLib error code:

- `Gtk.DialogError.DISMISSED` — User cancelled the dialog
- `Gio.IOErrorEnum.CANCELLED` — Operation cancelled via `Cancellable`
- `Gio.IOErrorEnum.NOT_FOUND` — File not found
- `Gio.IOErrorEnum.PERMISSION_DENIED` — Permission denied

See [Error Handling](./error-handling.md) for more details on `NativeError`.
