# Portals and Dialogs

GTKX supports rendering content outside the normal component tree using portals, and provides patterns for various dialog types.

## createPortal

Render a component into a different container:

```tsx
import { createPortal, useApplication } from "@gtkx/react";

const MyComponent = () => {
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    return (
        <>
            <GtkButton label="Main content" />

            {activeWindow && createPortal(
                <GtkAboutDialog programName="My App" />,
                activeWindow
            )}
        </>
    );
};
```

**Signature:**

```tsx
createPortal(
    children: ReactNode,
    container: Gtk.Widget,
    key?: string | null
): ReactPortal
```

## Dialog Types

### Alert Dialog

Simple confirmation or message dialog:

```tsx
import { GtkButton, useApplication } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const ConfirmDialog = () => {
    const app = useApplication();
    const [result, setResult] = useState<string | null>(null);

    const showConfirmation = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Confirm Action");
        dialog.setDetail("Are you sure you want to proceed?");
        dialog.setButtons(["Cancel", "OK"]);
        dialog.setCancelButton(0);
        dialog.setDefaultButton(1);

        try {
            const response = await dialog.choose(app.getActiveWindow() ?? undefined);
            setResult(response === 1 ? "Confirmed" : "Cancelled");
        } catch {
            setResult("Dismissed");
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkButton label="Show Confirmation" onClicked={showConfirmation} />
            {result && <GtkLabel label={`Result: ${result}`} />}
        </GtkBox>
    );
};
```

### About Dialog

Display application information:

```tsx
import { createPortal, GtkAboutDialog, GtkButton, useApplication } from "@gtkx/react";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState, useMemo } from "react";

const LOGO_PATH = new URL("../logo.svg", import.meta.url).pathname;

const AboutButton = () => {
    const [showDialog, setShowDialog] = useState(false);
    const logo = useMemo(() => Gdk.Texture.newFromFilename(LOGO_PATH), []);
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    return (
        <>
            <GtkButton label="About" onClicked={() => setShowDialog(true)} />

            {showDialog && activeWindow && createPortal(
                <GtkAboutDialog
                    programName="My Application"
                    version="1.0.0"
                    comments="A demonstration application"
                    website="https://github.com/example/app"
                    websiteLabel="GitHub"
                    copyright="Copyright 2024 Developer"
                    licenseType={Gtk.License.MIT_X11}
                    authors={["Developer One", "Developer Two"]}
                    logo={logo}
                    onCloseRequest={() => {
                        setShowDialog(false);
                        return false;
                    }}
                />,
                activeWindow
            )}
        </>
    );
};
```

### File Dialog

Open, save, or select files and folders:

```tsx
import { GtkButton, GtkLabel, GtkBox, useApplication } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const FileDialogs = () => {
    const app = useApplication();
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const openFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");

        try {
            const file = await dialog.open(app.getActiveWindow() ?? undefined);
            setSelectedFile(file.getPath() ?? null);
        } catch {
            // User cancelled
        }
    };

    const selectFolder = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Select Folder");

        try {
            const folder = await dialog.selectFolder(app.getActiveWindow() ?? undefined);
            setSelectedFile(folder.getPath() ?? null);
        } catch {
            // User cancelled
        }
    };

    const saveFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Save File");
        dialog.setInitialName("document.txt");

        try {
            const file = await dialog.save(app.getActiveWindow() ?? undefined);
            setSelectedFile(file.getPath() ?? null);
        } catch {
            // User cancelled
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkButton label="Open File..." onClicked={openFile} />
            <GtkButton label="Select Folder..." onClicked={selectFolder} />
            <GtkButton label="Save As..." onClicked={saveFile} />
            {selectedFile && <GtkLabel label={`Selected: ${selectedFile}`} />}
        </GtkBox>
    );
};
```

## Popovers

For bubble popups attached to widgets:

```tsx
import { GtkMenuButton, GtkPopover, GtkBox, GtkLabel, GtkButton, Slot } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const PopoverExample = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkMenuButton label="Open Popover">
            <Slot for={GtkMenuButton} id="popover">
                <GtkPopover>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginStart={12}
                        marginEnd={12}
                        marginTop={12}
                        marginBottom={12}
                    >
                        <GtkLabel label="Popover Content" cssClasses={["heading"]} />
                        <GtkLabel label="Interactive content inside" cssClasses={["dim-label"]} />
                        <GtkButton
                            label={`Clicked ${count} times`}
                            onClicked={() => setCount(c => c + 1)}
                            cssClasses={["suggested-action"]}
                        />
                    </GtkBox>
                </GtkPopover>
            </Slot>
        </GtkMenuButton>
    );
};
```

## useApplication Hook

Access the GTK application context:

```tsx
import { useApplication } from "@gtkx/react";

const MyComponent = () => {
    const app = useApplication();

    // Get active window for dialogs
    const activeWindow = app.getActiveWindow();

    // Access application instance
    const appId = app.getApplicationId();

    return <GtkLabel label={`App: ${appId}`} />;
};
```

## Dialog Patterns

### Imperative vs Declarative

**Imperative** (AlertDialog, FileDialog):
```tsx
const dialog = new Gtk.AlertDialog();
const result = await dialog.choose(window);
```

**Declarative** (AboutDialog with portal):
```tsx
{showDialog && createPortal(<GtkAboutDialog />, window)}
```

### Modal State Management

```tsx
const [modalState, setModalState] = useState<"closed" | "confirm" | "about">("closed");

const closeModal = () => setModalState("closed");

return (
    <>
        <GtkButton label="Confirm" onClicked={() => setModalState("confirm")} />
        <GtkButton label="About" onClicked={() => setModalState("about")} />

        {modalState === "confirm" && (
            // Show confirmation dialog
        )}

        {modalState === "about" && activeWindow && createPortal(
            <GtkAboutDialog onCloseRequest={() => { closeModal(); return false; }} />,
            activeWindow
        )}
    </>
);
```

### Error Handling

GTK dialogs throw `NativeError` when dismissed. See [Error Handling](./error-handling.md) for how to distinguish cancellation from actual errors, and [Async Operations](./async-operations.md) for comprehensive dialog examples.
