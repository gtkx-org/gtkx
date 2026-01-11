# Menus

GTKX provides a declarative API for building menus, replacing the imperative `Gio.Menu` construction with React components.

## Basic Menu

Attach a menu to a button with `GtkMenuButton`:

```tsx
import { x, GtkMenuButton } from "@gtkx/react";

const FileMenu = () => (
    <GtkMenuButton label="File">
        <x.MenuItem id="new" label="New" onActivate={() => console.log("New")} accels="<Control>n" />
        <x.MenuItem id="open" label="Open" onActivate={() => console.log("Open")} accels="<Control>o" />
        <x.MenuItem id="save" label="Save" onActivate={() => console.log("Save")} accels="<Control>s" />
    </GtkMenuButton>
);
```

## Menu Components

### x.MenuItem

Individual menu action with optional keyboard shortcut:

```tsx
<x.MenuItem
    id="save"                    // Unique identifier
    label="Save"                 // Display text
    onActivate={() => save()}    // Callback when activated
    accels="<Control>s"          // Keyboard shortcut
/>
```

### x.MenuSection

Groups items with an optional header.

```tsx
<GtkMenuButton label="Edit">
    <x.MenuItem id="undo" label="Undo" onActivate={undo} accels="<Control>z" />
    <x.MenuItem id="redo" label="Redo" onActivate={redo} accels="<Control><Shift>z" />

    <x.MenuSection label="Clipboard">
        <x.MenuItem id="cut" label="Cut" onActivate={cut} accels="<Control>x" />
        <x.MenuItem id="copy" label="Copy" onActivate={copy} accels="<Control>c" />
        <x.MenuItem id="paste" label="Paste" onActivate={paste} accels="<Control>v" />
    </x.MenuSection>
</GtkMenuButton>
```

### x.MenuSubmenu

Nested menu with its own items.

```tsx
<GtkMenuButton label="File">
    <x.MenuItem id="new" label="New" onActivate={handleNew} />

    <x.MenuSubmenu label="Recent Files">
        <x.MenuItem id="file1" label="document.txt" onActivate={() => openRecent("document.txt")} />
        <x.MenuItem id="file2" label="report.pdf" onActivate={() => openRecent("report.pdf")} />
        <x.MenuItem id="file3" label="notes.md" onActivate={() => openRecent("notes.md")} />
    </x.MenuSubmenu>

    <x.MenuSection>
        <x.MenuItem id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
    </x.MenuSection>
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
<x.MenuItem id="save" label="Save" accels={["<Control>s", "<Control><Shift>s"]} />
```

## Application Menu Bar

For a traditional menu bar, use `showMenubar` on the window and place menus as children:

```tsx
import { x, GtkApplicationWindow, quit } from "@gtkx/react";

const App = () => (
    <>
        <x.MenuSubmenu label="File">
            <x.MenuItem id="new" label="New" onActivate={handleNew} accels="<Control>n" />
            <x.MenuItem id="open" label="Open" onActivate={handleOpen} accels="<Control>o" />
            <x.MenuSection>
                <x.MenuItem id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
            </x.MenuSection>
        </x.MenuSubmenu>

        <x.MenuSubmenu label="Edit">
            <x.MenuItem id="undo" label="Undo" onActivate={handleUndo} accels="<Control>z" />
            <x.MenuItem id="redo" label="Redo" onActivate={handleRedo} accels="<Control><Shift>z" />
        </x.MenuSubmenu>

        <x.MenuSubmenu label="Help">
            <x.MenuItem id="about" label="About" onActivate={showAbout} />
        </x.MenuSubmenu>

        <GtkApplicationWindow title="My App" showMenubar onClose={quit}>
            {/* App content */}
        </GtkApplicationWindow>
    </>
);
```

## PopoverMenu with Custom Content

For more control, use `GtkPopoverMenu` with a `x.Slot`:

```tsx
import { x, GtkMenuButton, GtkPopoverMenu } from "@gtkx/react";

const CustomMenu = () => (
    <GtkMenuButton label="Actions">
        <x.Slot for={GtkMenuButton} id="popover">
            <GtkPopoverMenu>
                <x.MenuItem id="action1" label="Action 1" onActivate={action1} />
                <x.MenuItem id="action2" label="Action 2" onActivate={action2} />

                <x.MenuSection label="More Actions">
                    <x.MenuItem id="action3" label="Action 3" onActivate={action3} />
                </x.MenuSection>
            </GtkPopoverMenu>
        </x.Slot>
    </GtkMenuButton>
);
```

## Icon Buttons with Menus

Common pattern for icon-based menu buttons:

```tsx
<GtkMenuButton iconName="open-menu-symbolic" cssClasses={["flat"]}>
    <x.MenuItem id="preferences" label="Preferences" onActivate={showPrefs} accels="<Control>comma" />
    <x.MenuItem id="help" label="Help" onActivate={showHelp} accels="F1" />
    <x.MenuSection>
        <x.MenuItem id="about" label="About" onActivate={showAbout} />
    </x.MenuSection>
</GtkMenuButton>
```

## State Management

Track menu actions with React state:

```tsx
const [lastAction, setLastAction] = useState<string | null>(null);

<GtkMenuButton label="Actions">
    <x.MenuItem id="cut" label="Cut" onActivate={() => setLastAction("cut")} />
    <x.MenuItem id="copy" label="Copy" onActivate={() => setLastAction("copy")} />
    <x.MenuItem id="paste" label="Paste" onActivate={() => setLastAction("paste")} />
</GtkMenuButton>

{lastAction && <GtkLabel label={`Last action: ${lastAction}`} />}
```

## Complete Example

```tsx
import { x, GtkApplicationWindow, GtkBox, GtkMenuButton, GtkLabel, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
    const [document, setDocument] = useState("Untitled");

    return (
        <GtkApplicationWindow title={document} defaultWidth={600} defaultHeight={400} onClose={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} cssClasses={["toolbar"]}>
                    <GtkMenuButton label="File">
                        <x.MenuItem id="new" label="New" onActivate={() => setDocument("Untitled")} accels="<Control>n" />
                        <x.MenuItem id="open" label="Open..." onActivate={() => setDocument("Opened File")} accels="<Control>o" />
                        <x.MenuSection>
                            <x.MenuItem id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
                        </x.MenuSection>
                    </GtkMenuButton>

                    <GtkMenuButton label="Edit">
                        <x.MenuItem id="undo" label="Undo" accels="<Control>z" onActivate={() => {}} />
                        <x.MenuItem id="redo" label="Redo" accels="<Control><Shift>z" onActivate={() => {}} />
                    </GtkMenuButton>
                </GtkBox>

                <GtkLabel label={`Editing: ${document}`} vexpand valign={Gtk.Align.CENTER} />
            </GtkBox>
        </GtkApplicationWindow>
    );
};
```
