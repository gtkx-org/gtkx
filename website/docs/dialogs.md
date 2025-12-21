---
sidebar_position: 5
sidebar_label: Dialogs
---

# Dialogs

GTK4 provides several dialog types for common interactions. GTKX supports both declarative dialog components and GTK4's promise-based dialog APIs.

## Declarative Dialogs with Portals

Use `createPortal` to render dialogs at the root level of your application:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import {
  createPortal,
  GtkApplicationWindow,
  GtkButton,
  GtkAboutDialog,
  quit,
} from "@gtkx/react";
import { useState } from "react";

const App = () => {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <GtkApplicationWindow title="My App" onCloseRequest={quit}>
      <GtkButton label="About" onClicked={() => setShowAbout(true)} />

      {showAbout &&
        createPortal(
          <GtkAboutDialog
            programName="My App"
            version="1.0.0"
            comments="A GTKX application"
            website="https://example.com"
            licenseType={Gtk.License.MIT_X11}
            authors={["Your Name"]}
            onCloseRequest={() => {
              setShowAbout(false);
              return false;
            }}
          />
        )}
    </GtkApplicationWindow>
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
import { getApplication } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkButton, GtkLabel, GtkBox, quit } from "@gtkx/react";
import { useState } from "react";

const App = () => {
  const [result, setResult] = useState<string | null>(null);

  const showConfirmDialog = async () => {
    const app = getApplication();
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setDetail(
      "Are you sure you want to proceed? This cannot be undone."
    );
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
    <GtkApplicationWindow title="Dialogs" onCloseRequest={quit}>
      <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={12}
        marginStart={20}
        marginEnd={20}
        marginTop={20}
      >
        <GtkButton label="Delete Item" onClicked={showConfirmDialog} />
        {result && <GtkLabel label={`Result: ${result}`} />}
      </GtkBox>
    </GtkApplicationWindow>
  );
};
```

### File Dialogs

```tsx
import { getApplication } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";

const FilePicker = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const openFile = async () => {
    const app = getApplication();
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open File");

    const filter = new Gtk.FileFilter();
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
    const app = getApplication();
    const dialog = new Gtk.FileDialog();
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
      <GtkButton label="Open..." onClicked={openFile} />
      <GtkButton label="Save..." onClicked={saveFile} />
      {selectedFile && <GtkLabel label={selectedFile} />}
    </>
  );
};
```

## Color and Font Dialogs

```tsx
import { getApplication } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";

const pickColor = async () => {
  const app = getApplication();
  const dialog = new Gtk.ColorDialog();
  dialog.setTitle("Choose Color");

  try {
    const color = await dialog.chooseRgba(app.getActiveWindow() ?? undefined);
    console.log(
      `Selected: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`
    );
  } catch {
    // Cancelled
  }
};

const pickFont = async () => {
  const app = getApplication();
  const dialog = new Gtk.FontDialog();
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
<GtkAboutDialog modal onCloseRequest={() => { setShow(false); return false; }} />

// Non-modal dialog
<GtkAboutDialog modal={false} onCloseRequest={() => { setShow(false); return false; }} />
```

## Best Practices

1. **Use portals for declarative dialogs** — They render at the correct level in the widget hierarchy
2. **Use promise APIs for simple confirmations** — `AlertDialog.choose()` is cleaner than managing state
3. **Always handle cancellation** — Wrap `await` in try/catch for dismissed dialogs
4. **Set transient parent** — Pass the active window to `choose()`/`open()`/`save()` for proper stacking
