---
sidebar_position: 8
---

# Menus

GTKX provides components for building application menus and context menus using GTK's action-based menu system.

## Menu Structure

Menus are built with three virtual node components:

- **Menu.Item** - Individual menu entries with actions
- **Menu.Section** - Groups of related items with visual separators
- **Menu.Submenu** - Nested menu hierarchies

```tsx
import { Menu } from '@gtkx/react';

<Menu.Item id="save" label="Save" onActivate={handleSave} />
<Menu.Section label="Edit">
    <Menu.Item id="cut" label="Cut" onActivate={handleCut} />
    <Menu.Item id="copy" label="Copy" onActivate={handleCopy} />
</Menu.Section>
<Menu.Submenu label="View">
    <Menu.Item id="zoom-in" label="Zoom In" onActivate={zoomIn} />
</Menu.Submenu>
```

## Application Menu

Add a menu bar to the application window with `GtkApplication`:

```tsx
import {
    GtkApplication,
    GtkApplicationWindow,
    Menu,
    quit
} from '@gtkx/react';

function App() {
    return (
        <GtkApplication>
            <Menu.Submenu label="File">
                <Menu.Item
                    id="new"
                    label="New"
                    accels="<Control>n"
                    onActivate={handleNew}
                />
                <Menu.Item
                    id="open"
                    label="Open"
                    accels="<Control>o"
                    onActivate={handleOpen}
                />
                <Menu.Section>
                    <Menu.Item
                        id="quit"
                        label="Quit"
                        accels="<Control>q"
                        onActivate={quit}
                    />
                </Menu.Section>
            </Menu.Submenu>
            <Menu.Submenu label="Help">
                <Menu.Item
                    id="about"
                    label="About"
                    onActivate={showAbout}
                />
            </Menu.Submenu>
            <GtkApplicationWindow title="My App" showMenubar onCloseRequest={quit}>
                Content
            </GtkApplicationWindow>
        </GtkApplication>
    );
}
```

Key points:
- Menu items are children of `GtkApplication`
- Use `showMenubar` prop on `GtkApplicationWindow` to display the menu bar
- The `id` prop is required for each Menu.Item

## Menu.Item Props

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique action identifier (required) |
| `label` | `string` | Display text |
| `onActivate` | `() => void` | Handler when item is activated |
| `accels` | `string \| string[]` | Keyboard accelerator(s) |

## Keyboard Accelerators

Use GTK accelerator syntax for keyboard shortcuts:

```tsx
<Menu.Item id="save" label="Save" accels="<Control>s" />
<Menu.Item id="save-as" label="Save As" accels="<Control><Shift>s" />
<Menu.Item id="fullscreen" label="Fullscreen" accels="F11" />
```

Modifier keys:
- `<Control>` - Ctrl key
- `<Shift>` - Shift key
- `<Alt>` - Alt key
- `<Super>` - Super/Windows key

Multiple accelerators:

```tsx
<Menu.Item
    id="quit"
    label="Quit"
    accels={['<Control>q', '<Control>w']}
    onActivate={quit}
/>
```

## Menu.Section

Group related items with optional labels:

```tsx
<Menu.Submenu label="File">
    <Menu.Item id="new" label="New" onActivate={handleNew} />
    <Menu.Item id="open" label="Open" onActivate={handleOpen} />
    <Menu.Section label="Recent">
        <Menu.Item id="recent-1" label="Document.txt" onActivate={() => openRecent(1)} />
        <Menu.Item id="recent-2" label="Notes.md" onActivate={() => openRecent(2)} />
    </Menu.Section>
    <Menu.Section>
        <Menu.Item id="quit" label="Quit" onActivate={quit} />
    </Menu.Section>
</Menu.Submenu>
```

Sections create visual separators between groups of items.

## Menu.Submenu

Create nested menu hierarchies:

```tsx
<Menu.Submenu label="View">
    <Menu.Submenu label="Zoom">
        <Menu.Item id="zoom-in" label="Zoom In" accels="<Control>plus" onActivate={zoomIn} />
        <Menu.Item id="zoom-out" label="Zoom Out" accels="<Control>minus" onActivate={zoomOut} />
        <Menu.Item id="zoom-reset" label="Reset" accels="<Control>0" onActivate={zoomReset} />
    </Menu.Submenu>
    <Menu.Submenu label="Layout">
        <Menu.Item id="layout-grid" label="Grid" onActivate={() => setLayout('grid')} />
        <Menu.Item id="layout-list" label="List" onActivate={() => setLayout('list')} />
    </Menu.Submenu>
</Menu.Submenu>
```

## PopoverMenu

For context menus and menu buttons, use `GtkPopoverMenu`:

```tsx
import { GtkPopoverMenu, GtkMenuButton, Menu } from '@gtkx/react';

function OptionsButton() {
    return (
        <GtkMenuButton iconName="open-menu-symbolic">
            <GtkPopoverMenu>
                <Menu.Item id="edit" label="Edit" onActivate={handleEdit} />
                <Menu.Item id="duplicate" label="Duplicate" onActivate={handleDuplicate} />
                <Menu.Section>
                    <Menu.Item id="delete" label="Delete" onActivate={handleDelete} />
                </Menu.Section>
            </GtkPopoverMenu>
        </GtkMenuButton>
    );
}
```

The popover opens when the menu button is clicked.

## PopoverMenuBar

For an inline menu bar within your content (not in the title bar):

```tsx
import { GtkPopoverMenuBar, GtkBox, Menu } from '@gtkx/react';
import * as Gtk from '@gtkx/ffi/gtk';

<GtkBox orientation={Gtk.Orientation.VERTICAL}>
    <GtkPopoverMenuBar>
        <Menu.Submenu label="File">
            <Menu.Item id="new" label="New" onActivate={handleNew} />
            <Menu.Item id="open" label="Open" onActivate={handleOpen} />
        </Menu.Submenu>
        <Menu.Submenu label="Edit">
            <Menu.Item id="cut" label="Cut" onActivate={handleCut} />
            <Menu.Item id="copy" label="Copy" onActivate={handleCopy} />
        </Menu.Submenu>
    </GtkPopoverMenuBar>
    <GtkBox vexpand>
        Main content
    </GtkBox>
</GtkBox>
```

### Application Menu vs PopoverMenuBar

| Feature | Application Menu | PopoverMenuBar |
|---------|------------------|----------------|
| Location | Title bar (with `showMenubar`) | Inline in content |
| Parent | `GtkApplication` | Any container |
| Use case | Traditional app menus | Custom menu placement |

## Dynamic Menus

Menu content responds to React state:

```tsx
function RecentFilesMenu({ files }: { files: RecentFile[] }) {
    return (
        <Menu.Submenu label="Recent Files">
            {files.length === 0 ? (
                <Menu.Item id="no-recent" label="No recent files" />
            ) : (
                files.map((file, i) => (
                    <Menu.Item
                        key={file.path}
                        id={`recent-${i}`}
                        label={file.name}
                        accels={i < 9 ? `<Control>${i + 1}` : undefined}
                        onActivate={() => openFile(file.path)}
                    />
                ))
            )}
        </Menu.Submenu>
    );
}
```

## Action IDs

Each `Menu.Item` requires a unique `id` prop. GTKX uses this to:
- Create a `GAction` for the menu item
- Connect the action to the `onActivate` handler
- Set up keyboard accelerators

The action is registered with the nearest `ActionMap` (typically the Application or Window).

```tsx
// The id becomes the action name
<Menu.Item id="app.save" label="Save" onActivate={save} />

// Accelerators are bound to this action
<Menu.Item id="app.quit" label="Quit" accels="<Control>q" onActivate={quit} />
```

## Context Menus

For right-click context menus, combine `GtkPopoverMenu` with gesture handling:

```tsx
import { GtkPopoverMenu, GtkGestureClick, Menu } from '@gtkx/react';
import { useRef } from 'react';

function ContextMenuExample() {
    const popoverRef = useRef<Gtk.PopoverMenu>(null);

    return (
        <GtkBox>
            <GtkGestureClick
                button={3}
                onPressed={() => popoverRef.current?.popup()}
            >
                <GtkLabel label="Right-click me" />
            </GtkGestureClick>
            <GtkPopoverMenu ref={popoverRef}>
                <Menu.Item id="action1" label="Action 1" onActivate={action1} />
                <Menu.Item id="action2" label="Action 2" onActivate={action2} />
            </GtkPopoverMenu>
        </GtkBox>
    );
}
```
