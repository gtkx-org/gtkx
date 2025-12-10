---
sidebar_position: 4
sidebar_label: Menus
---

# Menus

GTKX provides components for building application menus, including the application-wide menu bar and popover menus for context menus and menu buttons.

## Application Menu Bar

The `ApplicationMenu` component creates an application-wide menu bar that appears in the window's title bar. **Important**: `ApplicationMenu` must be a sibling of `ApplicationWindow` at the root level, not a child of it.

```tsx
import { ApplicationMenu, ApplicationWindow, Menu, quit, render } from "@gtkx/react";

const App = () => (
  <>
    <ApplicationMenu>
      <Menu.Submenu label="File">
        <Menu.Item label="New" onActivate={handleNew} accels="<Control>n" />
        <Menu.Item label="Open" onActivate={handleOpen} accels="<Control>o" />
        <Menu.Section>
          <Menu.Item label="Quit" onActivate={quit} accels="<Control>q" />
        </Menu.Section>
      </Menu.Submenu>
      <Menu.Submenu label="Edit">
        <Menu.Item label="Cut" onActivate={handleCut} accels="<Control>x" />
        <Menu.Item label="Copy" onActivate={handleCopy} accels="<Control>c" />
        <Menu.Item label="Paste" onActivate={handlePaste} accels="<Control>v" />
      </Menu.Submenu>
      <Menu.Submenu label="Help">
        <Menu.Item label="About" onActivate={showAbout} />
      </Menu.Submenu>
    </ApplicationMenu>
    <ApplicationWindow title="My App" showMenubar onCloseRequest={quit}>
      {/* Window content */}
    </ApplicationWindow>
  </>
);

render(<App />, "org.example.MyApp");
```

Key points:
- Use `showMenubar` prop on `ApplicationWindow` to display the menu bar
- Place `ApplicationMenu` as a sibling of `ApplicationWindow`, not inside it
- The menu bar is set before the window is presented, ensuring it displays correctly

## Menu Components

### Menu.Item

Individual menu items with optional keyboard accelerators:

```tsx
<Menu.Item
  label="Save"
  onActivate={handleSave}
  accels="<Control>s"
/>
```

Props:
- `label`: Display text for the menu item
- `onActivate`: Callback when the item is clicked or accelerator is pressed
- `accels`: Keyboard accelerator (e.g., `"<Control>s"`, `"<Control><Shift>n"`, `"<Alt>F4"`)

### Menu.Section

Groups related menu items with an optional label and visual separator:

```tsx
<Menu.Submenu label="File">
  <Menu.Item label="New" onActivate={handleNew} />
  <Menu.Item label="Open" onActivate={handleOpen} />
  <Menu.Section label="Recent">
    <Menu.Item label="Document 1" onActivate={() => openRecent(1)} />
    <Menu.Item label="Document 2" onActivate={() => openRecent(2)} />
  </Menu.Section>
  <Menu.Section>
    <Menu.Item label="Quit" onActivate={quit} />
  </Menu.Section>
</Menu.Submenu>
```

### Menu.Submenu

Creates nested menus:

```tsx
<Menu.Submenu label="View">
  <Menu.Submenu label="Zoom">
    <Menu.Item label="Zoom In" onActivate={zoomIn} accels="<Control>plus" />
    <Menu.Item label="Zoom Out" onActivate={zoomOut} accels="<Control>minus" />
    <Menu.Item label="Reset Zoom" onActivate={zoomReset} accels="<Control>0" />
  </Menu.Submenu>
</Menu.Submenu>
```

## Popover Menus

For context menus and menu buttons, use `PopoverMenu` with `MenuButton`:

```tsx
import { MenuButton, PopoverMenu, Menu } from "@gtkx/react";

const OptionsButton = () => (
  <MenuButton.Root label="Options">
    <MenuButton.Popover>
      <PopoverMenu.Root>
        <Menu.Item label="Edit" onActivate={handleEdit} />
        <Menu.Item label="Duplicate" onActivate={handleDuplicate} />
        <Menu.Section>
          <Menu.Item label="Delete" onActivate={handleDelete} />
        </Menu.Section>
      </PopoverMenu.Root>
    </MenuButton.Popover>
  </MenuButton.Root>
);
```

## Keyboard Accelerators

Accelerator format uses GTK's accelerator syntax:

| Modifier | Syntax |
|----------|--------|
| Control | `<Control>` or `<Ctrl>` |
| Shift | `<Shift>` |
| Alt | `<Alt>` |
| Super (Windows key) | `<Super>` |

Examples:
- `<Control>s` - Ctrl+S
- `<Control><Shift>n` - Ctrl+Shift+N
- `<Alt>F4` - Alt+F4
- `<Control><Alt>Delete` - Ctrl+Alt+Delete

Multiple accelerators can be passed as an array:

```tsx
<Menu.Item
  label="Quit"
  onActivate={quit}
  accels={["<Control>q", "<Control>w"]}
/>
```

## PopoverMenuBar

`PopoverMenuBar` renders a traditional horizontal menu bar as a widget in your content area (rather than in the window titlebar). Use it when you need a menu bar positioned within your layout.

```tsx
import { ApplicationWindow, Box, PopoverMenuBar, Menu, quit } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

const App = () => (
  <ApplicationWindow title="My App" onCloseRequest={quit}>
    <Box orientation={Orientation.VERTICAL}>
      <PopoverMenuBar>
        <Menu.Submenu label="File">
          <Menu.Item label="New" onActivate={handleNew} accels="<Control>n" />
          <Menu.Item label="Open" onActivate={handleOpen} accels="<Control>o" />
          <Menu.Section>
            <Menu.Item label="Quit" onActivate={quit} accels="<Control>q" />
          </Menu.Section>
        </Menu.Submenu>
        <Menu.Submenu label="Edit">
          <Menu.Item label="Cut" onActivate={handleCut} />
          <Menu.Item label="Copy" onActivate={handleCopy} />
          <Menu.Item label="Paste" onActivate={handlePaste} />
        </Menu.Submenu>
      </PopoverMenuBar>
      {/* Rest of your content */}
    </Box>
  </ApplicationWindow>
);
```

Differences from `ApplicationMenu`:
- `PopoverMenuBar` is a regular widget you place anywhere in your layout
- `ApplicationMenu` must be a sibling of `ApplicationWindow` at root level
- `ApplicationMenu` shows in the window titlebar (requires `showMenubar` prop)
- `PopoverMenuBar` shows inline in your content area

## Dynamic Menus

Menu content can be dynamic using standard React patterns:

```tsx
const RecentFilesMenu = ({ recentFiles }) => (
  <Menu.Submenu label="Recent Files">
    {recentFiles.length === 0 ? (
      <Menu.Item label="No recent files" />
    ) : (
      recentFiles.map((file, index) => (
        <Menu.Item
          key={file.path}
          label={file.name}
          onActivate={() => openFile(file.path)}
          accels={index < 9 ? `<Control>${index + 1}` : undefined}
        />
      ))
    )}
  </Menu.Submenu>
);
```
