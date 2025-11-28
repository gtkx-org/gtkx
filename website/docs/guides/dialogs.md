---
sidebar_position: 3
---

# Working with Dialogs

This guide covers how to display dialogs and modal windows in GTKX applications.

## Dialog Types

GTKX supports several dialog types:

| Dialog | Purpose | API Style |
|--------|---------|-----------|
| `AlertDialog` | Alerts and confirmations | Promise-based (imperative) |
| `FileDialog` | File selection (open/save) | Promise-based (imperative) |
| `ColorDialog` | Color selection | Promise-based (imperative) |
| `FontDialog` | Font selection | Promise-based (imperative) |
| `AboutDialog` | Application information | React component |

## Setting Up the App Instance

To use dialogs with proper parent windows, export your app instance from the entry point:

```tsx
// src/index.tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

export const app = render(<App />, "com.example.myapp");
```

Then import it in components that need to show dialogs:

```tsx
import { app } from "./index.js";
```

## Promise-Based API (AlertDialog, FileDialog, ColorDialog, FontDialog)

These dialogs provide a modern Promise-based API that works seamlessly with async/await.

### AlertDialog

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { app } from "./index.js";

const handleConfirm = async () => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setDetail("Are you sure you want to proceed? This cannot be undone.");
    dialog.setButtons(["Cancel", "Delete"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
        const choice = await dialog.choose(app.getActiveWindow());
        if (choice === 1) {
            console.log("User confirmed deletion");
        } else {
            console.log("User cancelled");
        }
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
        const choice = await dialog.choose(app.getActiveWindow());
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

### FileDialog

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { app } from "./index.js";

// Open a single file
const handleOpen = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open File");

    try {
        const file = await dialog.open(app.getActiveWindow());
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
        const files = await dialog.openMultiple(app.getActiveWindow());
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
        const file = await dialog.save(app.getActiveWindow());
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
        const folder = await dialog.selectFolder(app.getActiveWindow());
        const path = folder.getPath();
        console.log(`Folder: ${path}`);
    } catch {
        console.log("Dialog cancelled");
    }
};
```

### ColorDialog

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { app } from "./index.js";

const handleChooseColor = async () => {
    const dialog = new Gtk.ColorDialog();
    dialog.setTitle("Choose Color");
    dialog.setWithAlpha(true);

    try {
        const rgba = await dialog.chooseRgba(app.getActiveWindow());
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
import * as Gtk from "@gtkx/ffi/gtk";
import { app } from "./index.js";

const handleChooseFont = async () => {
    const dialog = new Gtk.FontDialog();
    dialog.setTitle("Choose Font");

    try {
        const fontDesc = await dialog.chooseFont(app.getActiveWindow());
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
        const family = await dialog.chooseFamily(app.getActiveWindow());
        const name = family.getName();
        console.log(`Family: ${name}`);
    } catch {
        console.log("Dialog cancelled");
    }
};
```

## Complete Example

Here's a complete component using the Promise-based API:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { app } from "./index.js";

const FileSelector = () => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const handleOpen = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");

        try {
            const file = await dialog.open(app.getActiveWindow());
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

## React Component API (AboutDialog)

AboutDialog uses a different pattern—it's rendered as a React component:

```tsx
import { AboutDialog, Button, createPortal } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const AboutButton = () => {
    const [showAbout, setShowAbout] = useState(false);

    return (
        <>
            <Button label="About" onClicked={() => setShowAbout(true)} />

            {showAbout && createPortal(
                <AboutDialog
                    programName="My Application"
                    version="1.0.0"
                    comments="Built with GTKX"
                    copyright="Copyright 2024"
                    licenseType={Gtk.License.MIT_X11}
                    authors={["Developer Name"]}
                    website="https://example.com"
                    websiteLabel="Website"
                    onCloseRequest={() => {
                        setShowAbout(false);
                        return false;
                    }}
                />
            )}
        </>
    );
};
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
<MenuButton.Root label="Open Menu">
    <MenuButton.Popover>
        <Popover.Root>
            <Popover.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Label.Root label="Popover Content" />
                    <Button label="Action" onClicked={() => {}} />
                </Box>
            </Popover.Child>
        </Popover.Root>
    </MenuButton.Popover>
</MenuButton.Root>
```

## Error Handling

When using the Promise-based API, dialogs throw an error when cancelled. Always wrap dialog calls in try/catch:

```tsx
try {
    const result = await dialog.open(app.getActiveWindow());
    // Handle success
} catch {
    // Dialog was cancelled - this is normal user behavior
}
```

For more details on how async operations work in GTKX, see the [Async Results](./async-results.md) guide.

## Best Practices

### Always Pass the Active Window

Pass `app.getActiveWindow()` to dialog methods to ensure proper modal behavior:

```tsx
// Correct - dialog is modal to the active window
const file = await dialog.open(app.getActiveWindow());

// Works but may show warnings about transient parent
const file = await dialog.open();
```

### Handle Cancellation Gracefully

Users cancelling dialogs is normal behavior, not an error:

```tsx
try {
    const file = await dialog.open(app.getActiveWindow());
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
const file = await dialog.open(app.getActiveWindow());
```

### Use async/await

The Promise-based API provides cleaner code:

```tsx
// Recommended
const file = await dialog.open(app.getActiveWindow());

// Instead of callbacks or complex state management
```
