---
sidebar_position: 3
---

# Working with Dialogs

This guide covers how to display dialogs and modal windows in GTKX applications.

## Dialog Types

GTKX supports several dialog types:

| Dialog | Purpose |
|--------|---------|
| `FileDialog` | File selection (open/save) |
| `AlertDialog` | Alerts and confirmations |
| `AboutDialog` | Application information |
| `ColorDialog` | Color selection |
| `FontDialog` | Font selection |

## Promise-Based API (Recommended)

GTK4 dialogs provide a modern Promise-based API that works seamlessly with async/await. This is the recommended approach for handling dialogs.

### FileDialog

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

// Open a single file
const handleOpen = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open File");
    try {
        const file = await dialog.open();
        const path = file.getPath();
        console.log(`Selected: ${path}`);
    } catch {
        console.log("Dialog cancelled");
    }
};

// Open multiple files
const handleOpenMultiple = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open Multiple Files");
    try {
        const files = await dialog.openMultiple();
        // files is a Gio.ListModel containing Gio.File objects
        console.log("Multiple files selected");
    } catch {
        console.log("Dialog cancelled");
    }
};

// Save a file
const handleSave = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Save File");
    dialog.setInitialName("untitled.txt");
    try {
        const file = await dialog.save();
        const path = file.getPath();
        console.log(`Save to: ${path}`);
    } catch {
        console.log("Dialog cancelled");
    }
};

// Select a folder
const handleSelectFolder = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Select Folder");
    try {
        const folder = await dialog.selectFolder();
        const path = folder.getPath();
        console.log(`Folder: ${path}`);
    } catch {
        console.log("Dialog cancelled");
    }
};
```

### ColorDialog

```tsx
const handleChooseColor = async () => {
    const dialog = new Gtk.ColorDialog();
    dialog.setTitle("Choose Color");
    dialog.setWithAlpha(true);
    try {
        const rgba = await dialog.chooseRgba();
        const r = Math.round(rgba.red * 255);
        const g = Math.round(rgba.green * 255);
        const b = Math.round(rgba.blue * 255);
        const a = rgba.alpha;
        console.log(`RGBA: (${r}, ${g}, ${b}, ${a.toFixed(2)})`);
    } catch {
        console.log("Dialog cancelled");
    }
};
```

### FontDialog

```tsx
const handleChooseFont = async () => {
    const dialog = new Gtk.FontDialog();
    dialog.setTitle("Choose Font");
    try {
        const fontDesc = await dialog.chooseFont();
        const family = fontDesc.getFamily() ?? "Unknown";
        const size = fontDesc.getSize() / 1024;
        console.log(`Font: ${family}, ${size}pt`);
    } catch {
        console.log("Dialog cancelled");
    }
};

const handleChooseFontFamily = async () => {
    const dialog = new Gtk.FontDialog();
    dialog.setTitle("Choose Font Family");
    try {
        const family = await dialog.chooseFamily();
        const name = family.getName();
        console.log(`Family: ${name}`);
    } catch {
        console.log("Dialog cancelled");
    }
};
```

### AlertDialog

```tsx
const handleConfirm = async () => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setDetail("Are you sure you want to proceed? This cannot be undone.");
    dialog.setButtons(["Cancel", "Delete"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);
    try {
        const choice = await dialog.choose();
        const buttons = ["Cancel", "Delete"];
        console.log(`You clicked: ${buttons[choice]}`);
    } catch {
        console.log("Dialog dismissed");
    }
};

// Three-button dialog
const handleSaveChanges = async () => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Save Changes?");
    dialog.setDetail("You have unsaved changes. What would you like to do?");
    dialog.setButtons(["Don't Save", "Cancel", "Save"]);
    dialog.setCancelButton(1);
    dialog.setDefaultButton(2);
    try {
        const choice = await dialog.choose();
        switch (choice) {
            case 0: console.log("Discarding changes"); break;
            case 1: console.log("Cancelled"); break;
            case 2: console.log("Saving changes"); break;
        }
    } catch {
        console.log("Dialog dismissed");
    }
};
```

## Complete Example

Here's a complete component using the Promise-based API:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/gtkx";
import { useState } from "react";

const FileSelector = () => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const handleOpen = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");
        try {
            const file = await dialog.open();
            setSelectedFile(file.getPath());
        } catch {
            // User cancelled - do nothing
        }
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <Button label="Open File" onClicked={handleOpen} />
            <Label.Root
                label={selectedFile ?? "No file selected"}
                xalign={0}
            />
        </Box>
    );
};
```

## JSX Component API (Alternative)

For simple use cases, GTKX also provides JSX components that handle dialog visibility:

### AboutDialog

```tsx
const [showAbout, setShowAbout] = useState(false);

<Button label="About" onClicked={() => setShowAbout(true)} />

{showAbout && (
    <AboutDialog
        programName="My Application"
        version="1.0.0"
        comments="Built with GTKX"
        copyright="Copyright 2024"
        authors={["Developer Name"]}
        website="https://example.com"
        onCloseRequest={() => {
            setShowAbout(false);
            return false;
        }}
    />
)}
```

## Dialog Buttons (ColorDialogButton, FontDialogButton)

For simple color or font selection, use the built-in button widgets:

```tsx
<Box spacing={10}>
    <Label.Root label="Pick a color:" />
    <ColorDialogButton />
</Box>

<Box spacing={10}>
    <Label.Root label="Pick a font:" />
    <FontDialogButton />
</Box>
```

## Popover (Lightweight Dialog)

For lightweight modal content attached to a widget:

```tsx
<Popover.Root autohide>
    <Popover.Child>
        <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
            <Label.Root label="Popover Content" />
            <Button label="Action" onClicked={() => {}} />
        </Box>
    </Popover.Child>
    <Button label="Open Popover" />
</Popover.Root>
```

## Error Handling

When using the Promise-based API, dialogs throw an error when cancelled. Always wrap dialog calls in try/catch:

```tsx
try {
    const result = await dialog.open();
    // Handle success
} catch {
    // Dialog was cancelled - this is normal user behavior
}
```

For more details on how async operations work in GTKX, see the [Async Results](./async-results.md) guide.

## Best Practices

### Use async/await

The Promise-based API provides cleaner code:

```tsx
// Recommended
const file = await dialog.open();

// Instead of callbacks or state management
```

### Handle Cancellation Gracefully

Users cancelling dialogs is normal behavior, not an error:

```tsx
try {
    const file = await dialog.open();
    processFile(file);
} catch {
    // User cancelled - nothing to do
}
```

### Configure Dialogs Before Showing

Set all dialog properties before calling the async method:

```tsx
const dialog = new Gtk.FileDialog();
dialog.setTitle("Open Project");
dialog.setInitialFolder(projectsFolder);
const file = await dialog.open();
```
