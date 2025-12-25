---
sidebar_position: 9
---

# Async Operations

GTK provides asynchronous APIs for dialogs, file operations, and other blocking interactions. GTKX wraps these as Promise-based methods.

## How Async Works in GTK

GTK uses a callback-based async pattern internally. GTKX generates Promise wrappers for methods that accept `Gio.AsyncReadyCallback`:

```tsx
const dialog = new Gtk.FileDialog();
const file = await dialog.open(window);
```

Under the hood:
1. GTKX calls the async GTK function with a callback
2. The callback receives the async result
3. GTKX calls the corresponding `_finish` method
4. The Promise resolves with the result or rejects with a GError

## File Dialogs

### Opening Files

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import { useApplication } from '@gtkx/react';

function FileOpener() {
    const app = useApplication();

    const openFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle('Open File');

        try {
            const file = await dialog.open(app.getActiveWindow());
            const path = file.getPath();
            console.log('Selected:', path);
        } catch (error) {
            console.log('Cancelled or error');
        }
    };
}
```

### Opening Multiple Files

```tsx
const openMultiple = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Select Files');

    try {
        const files = await dialog.openMultiple(window);
        for (let i = 0; i < files.getNItems(); i++) {
            const file = files.getItem(i) as Gio.File;
            console.log(file.getPath());
        }
    } catch {
        console.log('Cancelled');
    }
};
```

### Saving Files

```tsx
const saveFile = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Save File');
    dialog.setInitialName('document.txt');

    try {
        const file = await dialog.save(window);
        console.log('Save to:', file.getPath());
    } catch {
        console.log('Cancelled');
    }
};
```

### Selecting Folders

```tsx
const selectFolder = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Select Folder');

    try {
        const folder = await dialog.selectFolder(window);
        console.log('Selected:', folder.getPath());
    } catch {
        console.log('Cancelled');
    }
};
```

### File Filters

```tsx
const openWithFilter = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Open Image');

    const filter = new Gtk.FileFilter();
    filter.setName('Images');
    filter.addMimeType('image/png');
    filter.addMimeType('image/jpeg');
    filter.addPattern('*.png');
    filter.addPattern('*.jpg');

    const filters = Gio.ListStore.new(Gtk.FileFilter.$gtype);
    filters.append(filter);
    dialog.setFilters(filters);
    dialog.setDefaultFilter(filter);

    const file = await dialog.open(window);
};
```

## Alert Dialogs

Display message dialogs with buttons:

```tsx
import * as Gtk from '@gtkx/ffi/gtk';

const showConfirm = async () => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage('Delete this item?');
    dialog.setDetail('This action cannot be undone.');
    dialog.setButtons(['Cancel', 'Delete']);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
        const response = await dialog.choose(window);
        if (response === 1) {
            performDelete();
        }
    } catch {
        console.log('Dismissed');
    }
};
```

### Response Values

The Promise resolves with the button index (0-based):

```tsx
dialog.setButtons(['No', 'Yes', 'Maybe']);
const response = await dialog.choose(window);

switch (response) {
    case 0: console.log('No'); break;
    case 1: console.log('Yes'); break;
    case 2: console.log('Maybe'); break;
}
```

### Dismissal

If the user dismisses the dialog (Escape key, close button), the Promise rejects. Always wrap in try/catch:

```tsx
try {
    const response = await dialog.choose(window);
    handleResponse(response);
} catch {
    handleDismiss();
}
```

## Color Dialog

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import * as Gdk from '@gtkx/ffi/gdk';

const pickColor = async () => {
    const dialog = new Gtk.ColorDialog();
    dialog.setTitle('Choose Color');
    dialog.setModal(true);
    dialog.setWithAlpha(true);

    try {
        const rgba = await dialog.chooseRgba(window);
        console.log(`Color: rgba(${rgba.red}, ${rgba.green}, ${rgba.blue}, ${rgba.alpha})`);
    } catch {
        console.log('Cancelled');
    }
};
```

### Initial Color

```tsx
const dialog = new Gtk.ColorDialog();
const initialColor = new Gdk.RGBA();
initialColor.parse('#3584e4');

const rgba = await dialog.chooseRgba(window, initialColor);
```

## Font Dialog

```tsx
import * as Gtk from '@gtkx/ffi/gtk';

const pickFont = async () => {
    const dialog = new Gtk.FontDialog();
    dialog.setTitle('Choose Font');
    dialog.setModal(true);

    try {
        const fontDesc = await dialog.chooseFont(window);
        console.log('Font:', fontDesc.toString());
    } catch {
        console.log('Cancelled');
    }
};
```

### Font with Face Selection

```tsx
const [fontDesc, face] = await dialog.chooseFontAndFeatures(window);
console.log('Font:', fontDesc.toString());
console.log('Face:', face.getFaceName());
```

## Print Dialog

```tsx
import * as Gtk from '@gtkx/ffi/gtk';

const printDocument = async () => {
    const dialog = new Gtk.PrintDialog();
    dialog.setTitle('Print Document');
    dialog.setModal(true);

    try {
        const printSettings = await dialog.print(window);
        console.log('Printer:', printSettings.getPrinter());
    } catch {
        console.log('Cancelled or error');
    }
};
```

## URI and File Launchers

Open files and URLs with the system default application:

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import * as Gio from '@gtkx/ffi/gio';

const openUrl = async () => {
    const launcher = new Gtk.UriLauncher('https://example.com');

    try {
        await launcher.launch(window);
    } catch (error) {
        console.log('Failed to open URL');
    }
};

const openFileExternal = async () => {
    const file = Gio.File.newForPath('/path/to/document.pdf');
    const launcher = new Gtk.FileLauncher(file);

    try {
        await launcher.launch(window);
    } catch (error) {
        console.log('Failed to open file');
    }
};
```

## Cancellation

Use `Gio.Cancellable` to cancel async operations:

```tsx
import * as Gio from '@gtkx/ffi/gio';

const cancellable = new Gio.Cancellable();

const openWithCancel = async () => {
    const dialog = new Gtk.FileDialog();

    try {
        const file = await dialog.open(window, cancellable);
        handleFile(file);
    } catch (error) {
        if (cancellable.isCancelled()) {
            console.log('Operation cancelled');
        } else {
            console.log('Error:', error);
        }
    }
};

const cancelOperation = () => {
    cancellable.cancel();
};
```

## Getting the Active Window

Most async dialogs need a parent window. Use `useApplication` to get it:

```tsx
import { useApplication } from '@gtkx/react';

function MyComponent() {
    const app = useApplication();

    const showDialog = async () => {
        const window = app.getActiveWindow();
        const dialog = new Gtk.AlertDialog();
        await dialog.choose(window);
    };
}
```

Or pass `undefined` if no window is available:

```tsx
await dialog.choose(undefined);
```

## Error Handling

Async operations throw `NativeError` when GTK reports an error. See [Error Handling](./error-handling) for details.

```tsx
import { NativeError } from '@gtkx/ffi';

try {
    const file = await dialog.open(window);
} catch (error) {
    if (error instanceof NativeError) {
        console.log('GTK Error:', error.message);
        console.log('Domain:', error.domain);
        console.log('Code:', error.code);
    }
}
```

## Best Practices

1. **Always use try/catch** - Dialogs can be dismissed or fail
2. **Pass the parent window** - Ensures proper stacking and modality
3. **Handle cancellation gracefully** - Users expect Cancel to do nothing
4. **Use cancellables for long operations** - Allow users to abort
5. **Check for active window** - It may be `null` during startup
