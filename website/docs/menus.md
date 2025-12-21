---
sidebar_position: 4
sidebar_label: Menus
---

# Menus

GTKX provides components for building application menus, including the application-wide menu bar and popover menus for context menus and menu buttons.

## Application Menu Bar

The `ApplicationMenu` component creates an application-wide menu bar that appears in the window's title bar. **Important**: `ApplicationMenu` must be a sibling of `ApplicationWindow` at the root level, not a child of it.

```tsx
import { GtkApplicationMenu, GtkApplicationWindow, GtkMenu, quit, render } from "@gtkx/react";

const App = () => (
  <>
    <GtkApplicationMenu>
      <GtkMenu.Submenu label="File">
        <GtkMenu.Item label="New" onActivate={handleNew} accels="<Control>n" />
        <GtkMenu.Item label="Open" onActivate={handleOpen} accels="<Control>o" />
        <GtkMenu.Section>
          <GtkMenu.Item label="Quit" onActivate={quit} accels="<Control>q" />
        </GtkMenu.Section>
      </GtkMenu.Submenu>
      <GtkMenu.Submenu label="Edit">
        <GtkMenu.Item label="Cut" onActivate={handleCut} accels="<Control>x" />
        <GtkMenu.Item label="Copy" onActivate={handleCopy} accels="<Control>c" />
        <GtkMenu.Item label="Paste" onActivate={handlePaste} accels="<Control>v" />
      </GtkMenu.Submenu>
      <GtkMenu.Submenu label="Help">
        <GtkMenu.Item label="About" onActivate={showAbout} />
      </GtkMenu.Submenu>
    </GtkApplicationMenu>
    <GtkApplicationWindow title="My App" showMenubar onCloseRequest={quit}>
      {/* Window content */}
    </GtkApplicationWindow>
  </>
);

render(<App />, "org.example.MyApp");
```

Key points:
- Use `showMenubar` prop on `GtkApplicationWindow` to display the menu bar
- Place `GtkApplicationMenu` as a sibling of `GtkApplicationWindow`, not inside it
- The menu bar is set before the window is presented, ensuring it displays correctly

## Menu Components

### GtkMenu.Item

Individual menu items with optional keyboard accelerators:

```tsx
<GtkMenu.Item
  label="Save"
  onActivate={handleSave}
  accels="<Control>s"
/>
```

Props:
- `label`: Display text for the menu item
- `onActivate`: Callback when the item is clicked or accelerator is pressed
- `accels`: Keyboard accelerator (e.g., `"<Control>s"`, `"<Control><Shift>n"`, `"<Alt>F4"`)

### GtkMenu.Section

Groups related menu items with an optional label and visual separator:

```tsx
<GtkMenu.Submenu label="File">
  <GtkMenu.Item label="New" onActivate={handleNew} />
  <GtkMenu.Item label="Open" onActivate={handleOpen} />
  <GtkMenu.Section label="Recent">
    <GtkMenu.Item label="Document 1" onActivate={() => openRecent(1)} />
    <GtkMenu.Item label="Document 2" onActivate={() => openRecent(2)} />
  </GtkMenu.Section>
  <GtkMenu.Section>
    <GtkMenu.Item label="Quit" onActivate={quit} />
  </GtkMenu.Section>
</GtkMenu.Submenu>
```

### GtkMenu.Submenu

Creates nested menus:

```tsx
<GtkMenu.Submenu label="View">
  <GtkMenu.Submenu label="Zoom">
    <GtkMenu.Item label="Zoom In" onActivate={zoomIn} accels="<Control>plus" />
    <GtkMenu.Item label="Zoom Out" onActivate={zoomOut} accels="<Control>minus" />
    <GtkMenu.Item label="Reset Zoom" onActivate={zoomReset} accels="<Control>0" />
  </GtkMenu.Submenu>
</GtkMenu.Submenu>
```

## Popover Menus

For context menus and menu buttons, use `GtkPopoverMenu` with `GtkMenuButton`:

```tsx
import { GtkMenuButton, GtkPopoverMenu, GtkMenu } from "@gtkx/react";

const OptionsButton = () => (
  <GtkMenuButton.Root label="Options">
    <GtkMenuButton.Popover>
      <GtkPopoverMenu.Root>
        <GtkMenu.Item label="Edit" onActivate={handleEdit} />
        <GtkMenu.Item label="Duplicate" onActivate={handleDuplicate} />
        <GtkMenu.Section>
          <GtkMenu.Item label="Delete" onActivate={handleDelete} />
        </GtkMenu.Section>
      </GtkPopoverMenu.Root>
    </GtkMenuButton.Popover>
  </GtkMenuButton.Root>
);
```

## Keyboard Accelerators

Use the `accels` prop with GTK accelerator syntax (e.g., `"<Control>s"`, `"<Control><Shift>n"`). Multiple accelerators can be passed as an array:

```tsx
<GtkMenu.Item
  label="Quit"
  onActivate={quit}
  accels={["<Control>q", "<Control>w"]}
/>
```

## GtkPopoverMenuBar

`GtkPopoverMenuBar` renders a traditional horizontal menu bar as a widget in your content area (rather than in the window titlebar). Use it when you need a menu bar positioned within your layout.

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkPopoverMenuBar, GtkMenu, quit } from "@gtkx/react";

const App = () => (
  <GtkApplicationWindow title="My App" onCloseRequest={quit}>
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
      <GtkPopoverMenuBar>
        <GtkMenu.Submenu label="File">
          <GtkMenu.Item label="New" onActivate={handleNew} accels="<Control>n" />
          <GtkMenu.Item label="Open" onActivate={handleOpen} accels="<Control>o" />
          <GtkMenu.Section>
            <GtkMenu.Item label="Quit" onActivate={quit} accels="<Control>q" />
          </GtkMenu.Section>
        </GtkMenu.Submenu>
        <GtkMenu.Submenu label="Edit">
          <GtkMenu.Item label="Cut" onActivate={handleCut} />
          <GtkMenu.Item label="Copy" onActivate={handleCopy} />
          <GtkMenu.Item label="Paste" onActivate={handlePaste} />
        </GtkMenu.Submenu>
      </GtkPopoverMenuBar>
      {/* Rest of your content */}
    </GtkBox>
  </GtkApplicationWindow>
);
```

Differences from `GtkApplicationMenu`:
- `GtkPopoverMenuBar` is a regular widget you place anywhere in your layout
- `GtkApplicationMenu` must be a sibling of `GtkApplicationWindow` at root level
- `GtkApplicationMenu` shows in the window titlebar (requires `showMenubar` prop)
- `GtkPopoverMenuBar` shows inline in your content area

## Dynamic Menus

Menu content can be dynamic using standard React patterns:

```tsx
const RecentFilesMenu = ({ recentFiles }) => (
  <GtkMenu.Submenu label="Recent Files">
    {recentFiles.length === 0 ? (
      <GtkMenu.Item label="No recent files" />
    ) : (
      recentFiles.map((file, index) => (
        <GtkMenu.Item
          key={file.path}
          label={file.name}
          onActivate={() => openFile(file.path)}
          accels={index < 9 ? `<Control>${index + 1}` : undefined}
        />
      ))
    )}
  </GtkMenu.Submenu>
);
```
