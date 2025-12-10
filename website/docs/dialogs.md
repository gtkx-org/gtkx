---
sidebar_position: 5
sidebar_label: Dialogs
---

# Dialogs

GTK4 provides several dialog types for common interactions. GTKX supports both declarative dialog components and GTK4's promise-based dialog APIs.

## Declarative Dialogs with Portals

Use `createPortal` to render dialogs at the root level of your application:

```tsx
import { createPortal, ApplicationWindow, Button, AboutDialog, quit } from "@gtkx/react";
import { License } from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <ApplicationWindow title="My App" onCloseRequest={quit}>
      <Button label="About" onClicked={() => setShowAbout(true)} />

      {showAbout && createPortal(
        <AboutDialog
          programName="My App"
          version="1.0.0"
          comments="A GTKX application"
          website="https://example.com"
          licenseType={License.MIT_X11}
          authors={["Your Name"]}
          onCloseRequest={() => {
            setShowAbout(false);
            return false;
          }}
        />
      )}
    </ApplicationWindow>
  );
};
```

### How Portal Dialogs Work

1. `createPortal` without a container renders at the application root
2. Dialog widgets automatically set their transient parent to the active window
3. `onCloseRequest` handles the close button — return `false` to allow closing
4. The dialog is presented (shown) when mounted and closed when unmounted

## Promise-Based Dialogs

GTK4's `AlertDialog` and file dialogs use async/await patterns:

### AlertDialog

```tsx
import { getCurrentApp } from "@gtkx/ffi";
import { AlertDialog, Orientation } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Button, Label, Box, quit } from "@gtkx/react";
import { useState } from "react";

const App = () => {
  const [result, setResult] = useState<string | null>(null);

  const showConfirmDialog = async () => {
    const app = getCurrentApp();
    const dialog = new AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setDetail("Are you sure you want to proceed? This cannot be undone.");
    dialog.setButtons(["Cancel", "Delete"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
      const response = await dialog.choose(app.getActiveWindow() ?? undefined);
      setResult(response === 1 ? "Deleted" : "Cancelled");
    } catch {
      // Dialog was dismissed (e.g., Escape key)
      setResult("Dismissed");
    }
  };

  return (
    <ApplicationWindow title="Dialogs" onCloseRequest={quit}>
      <Box orientation={Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
        <Button label="Delete Item" onClicked={showConfirmDialog} />
        {result && <Label.Root label={`Result: ${result}`} />}
      </Box>
    </ApplicationWindow>
  );
};
```

### AlertDialog API

| Method | Description |
|--------|-------------|
| `setMessage(text)` | Main dialog message |
| `setDetail(text)` | Secondary explanation text |
| `setButtons(labels)` | Array of button labels |
| `setCancelButton(index)` | Which button is triggered by Escape |
| `setDefaultButton(index)` | Which button has default focus |
| `choose(parent)` | Show dialog and return `Promise<number>` with button index |

### File Dialogs

```tsx
import { getCurrentApp } from "@gtkx/ffi";
import { FileDialog, FileFilter } from "@gtkx/ffi/gtk";
import { Button, Label } from "@gtkx/react";
import { useState } from "react";

const FilePicker = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const openFile = async () => {
    const app = getCurrentApp();
    const dialog = new FileDialog();
    dialog.setTitle("Open File");

    // Optional: Add file filters
    const filter = new FileFilter();
    filter.setName("Text Files");
    filter.addPattern("*.txt");
    filter.addMimeType("text/plain");

    try {
      const file = await dialog.open(app.getActiveWindow() ?? undefined);
      setSelectedFile(file.getPath());
    } catch {
      // User cancelled
    }
  };

  const saveFile = async () => {
    const app = getCurrentApp();
    const dialog = new FileDialog();
    dialog.setTitle("Save File");
    dialog.setInitialName("document.txt");

    try {
      const file = await dialog.save(app.getActiveWindow() ?? undefined);
      setSelectedFile(file.getPath());
    } catch {
      // User cancelled
    }
  };

  return (
    <>
      <Button label="Open..." onClicked={openFile} />
      <Button label="Save..." onClicked={saveFile} />
      {selectedFile && <Label.Root label={selectedFile} />}
    </>
  );
};
```

### FileDialog API

| Method | Description |
|--------|-------------|
| `setTitle(text)` | Dialog title |
| `setInitialName(name)` | Default filename for save dialogs |
| `setInitialFolder(file)` | Starting directory |
| `open(parent)` | Show open dialog, returns `Promise<Gio.File>` |
| `save(parent)` | Show save dialog, returns `Promise<Gio.File>` |
| `selectFolder(parent)` | Show folder picker, returns `Promise<Gio.File>` |

## Color and Font Dialogs

```tsx
import { getCurrentApp } from "@gtkx/ffi";
import { ColorDialog, FontDialog } from "@gtkx/ffi/gtk";

// Color picker
const pickColor = async () => {
  const app = getCurrentApp();
  const dialog = new ColorDialog();
  dialog.setTitle("Choose Color");

  try {
    const color = await dialog.chooseRgba(app.getActiveWindow() ?? undefined);
    console.log(`Selected: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`);
  } catch {
    // Cancelled
  }
};

// Font picker
const pickFont = async () => {
  const app = getCurrentApp();
  const dialog = new FontDialog();
  dialog.setTitle("Choose Font");

  try {
    const font = await dialog.chooseFont(app.getActiveWindow() ?? undefined);
    console.log(`Selected: ${font.toString()}`);
  } catch {
    // Cancelled
  }
};
```

## Modal vs Non-Modal

Dialogs can be modal (block interaction with parent) or non-modal:

```tsx
// Modal dialog (default for AlertDialog)
<AboutDialog modal onCloseRequest={() => { setShow(false); return false; }} />

// Non-modal dialog
<AboutDialog modal={false} onCloseRequest={() => { setShow(false); return false; }} />
```

## Best Practices

1. **Use portals for declarative dialogs** — They render at the correct level in the widget hierarchy
2. **Use promise APIs for simple confirmations** — `AlertDialog.choose()` is cleaner than managing state
3. **Always handle cancellation** — Wrap `await` in try/catch for dismissed dialogs
4. **Set transient parent** — Pass the active window to `choose()`/`open()`/`save()` for proper stacking
