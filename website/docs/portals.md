# Portals and Dialogs

GTKX supports rendering content outside the normal component tree using portals, and provides patterns for various dialog types.

## createPortal

Render a component into a different container—typically used for dialogs that need to appear as children of the active window:

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

## Dialog Approaches

GTKX supports two dialog patterns:

### Declarative (with createPortal)

Best for dialogs with React content or that need state management:

```tsx
import { createPortal, GtkAboutDialog, GtkButton, useApplication } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const AboutButton = () => {
    const [showDialog, setShowDialog] = useState(false);
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    return (
        <>
            <GtkButton label="About" onClicked={() => setShowDialog(true)} />

            {showDialog && activeWindow && createPortal(
                <GtkAboutDialog
                    programName="My Application"
                    version="1.0.0"
                    licenseType={Gtk.License.MIT_X11}
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

### Imperative (async/await)

Best for quick confirmations and file pickers. These are GTK's native dialog APIs wrapped as Promises by GTKX:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { useApplication } from "@gtkx/react";

const FilePickerButton = () => {
    const app = useApplication();

    const pickFile = async () => {
        const dialog = new Gtk.FileDialog();
        try {
            const file = await dialog.open(app.getActiveWindow() ?? undefined);
            console.log("Selected:", file.getPath());
        } catch {
            // User cancelled
        }
    };

    return <GtkButton label="Open File" onClicked={pickFile} />;
};
```

See [Async Operations](./async-operations.md) for the full list of Promise-wrapped dialog APIs and error handling patterns.

## Popovers

For bubble popups attached to widgets, use the GTKX `Slot` pattern:

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

Access the GTK application context for getting the active window (needed for dialogs):

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

## Modal State Management

For apps with multiple dialog types:

```tsx
const [modalState, setModalState] = useState<"closed" | "confirm" | "about">("closed");

return (
    <>
        <GtkButton label="About" onClicked={() => setModalState("about")} />

        {modalState === "about" && activeWindow && createPortal(
            <GtkAboutDialog onCloseRequest={() => { setModalState("closed"); return false; }} />,
            activeWindow
        )}
    </>
);
```
