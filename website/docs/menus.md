# Menus

GTKX provides a declarative API for building menus, replacing the imperative `Gio.Menu` construction with React components.

## Basic Menu

Attach a menu to a button with `GtkMenuButton`:

```tsx
import { GtkMenuButton, Menu } from "@gtkx/react";

const FileMenu = () => (
    <GtkMenuButton label="File">
        <Menu.Item id="new" label="New" onActivate={() => console.log("New")} accels="<Control>n" />
        <Menu.Item id="open" label="Open" onActivate={() => console.log("Open")} accels="<Control>o" />
        <Menu.Item id="save" label="Save" onActivate={() => console.log("Save")} accels="<Control>s" />
    </GtkMenuButton>
);
```

## Menu Components

### Menu.Item

Individual menu action with optional keyboard shortcut:

```tsx
<Menu.Item
    id="save"                    // Unique identifier
    label="Save"                 // Display text
    onActivate={() => save()}    // Callback when activated
    accels="<Control>s"          // Keyboard shortcut
/>
```

### Menu.Section

Groups items with an optional header.

```tsx
<GtkMenuButton label="Edit">
    <Menu.Item id="undo" label="Undo" onActivate={undo} accels="<Control>z" />
    <Menu.Item id="redo" label="Redo" onActivate={redo} accels="<Control><Shift>z" />

    <Menu.Section label="Clipboard">
        <Menu.Item id="cut" label="Cut" onActivate={cut} accels="<Control>x" />
        <Menu.Item id="copy" label="Copy" onActivate={copy} accels="<Control>c" />
        <Menu.Item id="paste" label="Paste" onActivate={paste} accels="<Control>v" />
    </Menu.Section>
</GtkMenuButton>
```

### Menu.Submenu

Nested menu with its own items.

```tsx
<GtkMenuButton label="File">
    <Menu.Item id="new" label="New" onActivate={handleNew} />

    <Menu.Submenu label="Recent Files">
        <Menu.Item id="file1" label="document.txt" onActivate={() => openRecent("document.txt")} />
        <Menu.Item id="file2" label="report.pdf" onActivate={() => openRecent("report.pdf")} />
        <Menu.Item id="file3" label="notes.md" onActivate={() => openRecent("notes.md")} />
    </Menu.Submenu>

    <Menu.Section>
        <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
    </Menu.Section>
</GtkMenuButton>
```

## Keyboard Shortcuts

Shortcuts use GTK's accelerator syntax:

| Shortcut | Syntax |
|----------|--------|
| Ctrl+N | `<Control>n` |
| Ctrl+Shift+Z | `<Control><Shift>z` |
| Ctrl+, | `<Control>comma` |
| F1 | `F1` |
| Alt+F4 | `<Alt>F4` |

Multiple shortcuts for one action:

```tsx
<Menu.Item id="save" label="Save" accels={["<Control>s", "<Control><Shift>s"]} />
```

## Application Menu Bar

For a traditional menu bar, use `showMenubar` on the window and place menus as children:

```tsx
import { GtkApplicationWindow, Menu, quit } from "@gtkx/react";

const App = () => (
    <>
        <Menu.Submenu label="File">
            <Menu.Item id="new" label="New" onActivate={handleNew} accels="<Control>n" />
            <Menu.Item id="open" label="Open" onActivate={handleOpen} accels="<Control>o" />
            <Menu.Section>
                <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
            </Menu.Section>
        </Menu.Submenu>

        <Menu.Submenu label="Edit">
            <Menu.Item id="undo" label="Undo" onActivate={handleUndo} accels="<Control>z" />
            <Menu.Item id="redo" label="Redo" onActivate={handleRedo} accels="<Control><Shift>z" />
        </Menu.Submenu>

        <Menu.Submenu label="Help">
            <Menu.Item id="about" label="About" onActivate={showAbout} />
        </Menu.Submenu>

        <GtkApplicationWindow title="My App" showMenubar onCloseRequest={quit}>
            {/* App content */}
        </GtkApplicationWindow>
    </>
);
```

## PopoverMenu with Custom Content

For more control, use `GtkPopoverMenu` with a `Slot`:

```tsx
import { GtkMenuButton, GtkPopoverMenu, Menu, Slot } from "@gtkx/react";

const CustomMenu = () => (
    <GtkMenuButton label="Actions">
        <Slot for={GtkMenuButton} id="popover">
            <GtkPopoverMenu>
                <Menu.Item id="action1" label="Action 1" onActivate={action1} />
                <Menu.Item id="action2" label="Action 2" onActivate={action2} />

                <Menu.Section label="More Actions">
                    <Menu.Item id="action3" label="Action 3" onActivate={action3} />
                </Menu.Section>
            </GtkPopoverMenu>
        </Slot>
    </GtkMenuButton>
);
```

## Icon Buttons with Menus

Common pattern for icon-based menu buttons:

```tsx
<GtkMenuButton iconName="open-menu-symbolic" cssClasses={["flat"]}>
    <Menu.Item id="preferences" label="Preferences" onActivate={showPrefs} accels="<Control>comma" />
    <Menu.Item id="help" label="Help" onActivate={showHelp} accels="F1" />
    <Menu.Section>
        <Menu.Item id="about" label="About" onActivate={showAbout} />
    </Menu.Section>
</GtkMenuButton>
```

## State Management

Track menu actions with React state:

```tsx
const [lastAction, setLastAction] = useState<string | null>(null);

<GtkMenuButton label="Actions">
    <Menu.Item id="cut" label="Cut" onActivate={() => setLastAction("cut")} />
    <Menu.Item id="copy" label="Copy" onActivate={() => setLastAction("copy")} />
    <Menu.Item id="paste" label="Paste" onActivate={() => setLastAction("paste")} />
</GtkMenuButton>

{lastAction && <GtkLabel label={`Last action: ${lastAction}`} />}
```

## Complete Example

```tsx
import { GtkApplicationWindow, GtkBox, GtkMenuButton, GtkLabel, Menu, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
    const [document, setDocument] = useState("Untitled");

    return (
        <GtkApplicationWindow title={document} defaultWidth={600} defaultHeight={400} onCloseRequest={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} cssClasses={["toolbar"]}>
                    <GtkMenuButton label="File">
                        <Menu.Item id="new" label="New" onActivate={() => setDocument("Untitled")} accels="<Control>n" />
                        <Menu.Item id="open" label="Open..." onActivate={() => setDocument("Opened File")} accels="<Control>o" />
                        <Menu.Section>
                            <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
                        </Menu.Section>
                    </GtkMenuButton>

                    <GtkMenuButton label="Edit">
                        <Menu.Item id="undo" label="Undo" accels="<Control>z" onActivate={() => {}} />
                        <Menu.Item id="redo" label="Redo" accels="<Control><Shift>z" onActivate={() => {}} />
                    </GtkMenuButton>
                </GtkBox>

                <GtkLabel label={`Editing: ${document}`} vexpand valign={Gtk.Align.CENTER} />
            </GtkBox>
        </GtkApplicationWindow>
    );
};
```
