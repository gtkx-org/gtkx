# @gtkx/gtkx

The React integration layer for GTKX. This package provides a custom React reconciler that renders React components as native GTK4 widgets.

## Installation

```bash
pnpm add @gtkx/gtkx react
```

### Peer Dependencies

- `react` ^19.0.0

### System Requirements

- **Linux** with GTK4 development libraries installed
- **Node.js** 20 or later
- **Rust** toolchain (for building the native module)

#### Installing GTK4 on Fedora

```bash
sudo dnf install gtk4-devel
```

#### Installing GTK4 on Ubuntu/Debian

```bash
sudo apt install libgtk-4-dev
```

## Quick Start

Create a simple GTK4 application:

```tsx
import { ApplicationWindow, Button, quit, render } from "@gtkx/gtkx";

render(
  <ApplicationWindow
    title="My App"
    defaultWidth={800}
    defaultHeight={600}
    onCloseRequest={quit}
  >
    <Button label="Hello!" onClicked={() => console.log("Clicked!")} />
  </ApplicationWindow>,
  "com.example.myapp"
);
```

Run with:

```bash
npx tsx src/index.tsx
```

## API Reference

### Core Functions

#### `render(element, applicationId)`

Renders a React element tree as a GTK4 application.

```tsx
render(<ApplicationWindow>...</ApplicationWindow>, "com.example.app");
```

- `element` — The root React element (typically `ApplicationWindow`)
- `applicationId` — Unique application identifier in reverse-DNS format

#### `quit()`

Signals the application to close. Typically used as the `onCloseRequest` handler:

```tsx
<ApplicationWindow onCloseRequest={quit}>...</ApplicationWindow>
```

Returns `true` to indicate the close request was handled.

#### `createRef()`

Creates a reference object for passing to FFI functions that require output parameters:

```tsx
import { createRef } from "@gtkx/gtkx";

const ref = createRef();
someGtkFunction(ref);
console.log(ref.value); // The value set by GTK
```

## Widgets

### Container Widgets

#### ApplicationWindow

The main application window. Every GTKX app starts with this.

```tsx
<ApplicationWindow
  title="Window Title"
  defaultWidth={800}
  defaultHeight={600}
  onCloseRequest={quit}
>
  {children}
</ApplicationWindow>
```

#### Box

A container that arranges children in a single row or column.

```tsx
<Box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
  <Button label="First" />
  <Button label="Second" />
</Box>
```

#### Grid

Arranges children in a grid layout.

```tsx
<Grid columnSpacing={10} rowSpacing={10}>
  <Button label="(0,0)" />
  <Button label="(1,0)" />
  <Button label="(0,1)" />
  <Button label="(1,1)" />
</Grid>
```

#### ScrolledWindow

Adds scrollbars to content that exceeds its allocated size.

```tsx
<ScrolledWindow vexpand hexpand>
  <TextView />
</ScrolledWindow>
```

#### Frame

A decorative container with an optional label.

```tsx
<Frame.Root>
  <Frame.LabelWidget>
    <Label.Root label="Section Title" />
  </Frame.LabelWidget>
  <Frame.Child>
    <Box>{/* content */}</Box>
  </Frame.Child>
</Frame.Root>
```

#### Notebook

A tabbed container.

```tsx
<Notebook>
  <Box>{/* Tab 1 content */}</Box>
  <Box>{/* Tab 2 content */}</Box>
</Notebook>
```

#### Paned

A resizable split container.

```tsx
<Paned.Root wideHandle>
  <Paned.StartChild>
    <Box>{/* Left pane */}</Box>
  </Paned.StartChild>
  <Paned.EndChild>
    <Box>{/* Right pane */}</Box>
  </Paned.EndChild>
</Paned.Root>
```

### Input Widgets

#### Button

A clickable button.

```tsx
<Button label="Click me" onClicked={() => console.log("Clicked!")} />
```

#### ToggleButton

A button with on/off state.

```tsx
const [active, setActive] = useState(false);

<ToggleButton.Root
  label={active ? "ON" : "OFF"}
  active={active}
  onToggled={() => setActive((a) => !a)}
/>;
```

#### CheckButton

A checkbox with a label.

```tsx
<CheckButton.Root
  label="Accept terms"
  active={checked}
  onToggled={() => setChecked((c) => !c)}
/>
```

#### Switch

An on/off toggle switch.

```tsx
<Switch
  active={enabled}
  onStateSet={() => {
    setEnabled((e) => !e);
    return true;
  }}
/>
```

#### Entry

A single-line text input.

```tsx
<Entry placeholderText="Enter text..." text={value} onChanged={handleChange} />
```

#### SearchEntry

A text input styled for search.

```tsx
<SearchEntry placeholderText="Search..." />
```

#### SpinButton

A numeric input with increment/decrement buttons.

```tsx
<SpinButton />
```

#### Scale

A horizontal or vertical slider.

```tsx
<Scale hexpand drawValue />
```

#### TextView

A multi-line text editor.

```tsx
<ScrolledWindow>
  <TextView editable wrapMode={Gtk.WrapMode.WORD} />
</ScrolledWindow>
```

### Display Widgets

#### Label

Displays text.

```tsx
<Label.Root label="Hello, World!" />
```

#### ProgressBar

Shows progress of an operation.

```tsx
<ProgressBar fraction={0.5} showText />
```

#### LevelBar

Displays a value within a range.

```tsx
<LevelBar value={0.7} />
```

#### Spinner

An animated loading indicator.

```tsx
<Spinner spinning={isLoading} />
```

### Layout Widgets

#### HeaderBar

A title bar with optional buttons.

```tsx
<HeaderBar.Root>
  <HeaderBar.TitleWidget>
    <Label.Root label="App Title" />
  </HeaderBar.TitleWidget>
</HeaderBar.Root>
```

#### CenterBox

Positions children at start, center, and end.

```tsx
<CenterBox.Root>
  <CenterBox.StartWidget>
    <Button label="Left" />
  </CenterBox.StartWidget>
  <CenterBox.CenterWidget>
    <Label.Root label="Center" />
  </CenterBox.CenterWidget>
  <CenterBox.EndWidget>
    <Button label="Right" />
  </CenterBox.EndWidget>
</CenterBox.Root>
```

#### ActionBar

A bar with action buttons, typically at the bottom.

```tsx
<ActionBar revealed>
  <Button label="Save" />
  <Button label="Cancel" />
</ActionBar>
```

### List Widgets

#### ListBox

A vertical list of selectable rows.

```tsx
<ListBox selectionMode={Gtk.SelectionMode.SINGLE}>
  <ListBoxRow>
    <Label.Root label="Item 1" />
  </ListBoxRow>
  <ListBoxRow>
    <Label.Root label="Item 2" />
  </ListBoxRow>
</ListBox>
```

#### ListView

A virtualized list for large datasets.

```tsx
<ListView.Root
  renderItem={(item) => {
    const box = new Gtk.Box();
    const label = new Gtk.Label(item?.text ?? "");
    box.append(label.ptr);
    return box;
  }}
>
  {items.map((item) => (
    <ListView.Item item={item} key={item.id} />
  ))}
</ListView.Root>
```

### Dialog Widgets

#### Popover

A popup attached to a widget.

```tsx
<Popover.Root autohide>
  <Popover.Child>
    <Box>{/* Popover content */}</Box>
  </Popover.Child>
  <Button label="Show Popover" />
</Popover.Root>
```

#### MenuButton

A button that shows a menu when clicked.

```tsx
<MenuButton.Root label="Menu">
  <MenuButton.Popover>
    <Popover.Root>
      <Popover.Child>
        <Box>
          <Button label="Option 1" />
          <Button label="Option 2" />
        </Box>
      </Popover.Child>
    </Popover.Root>
  </MenuButton.Popover>
</MenuButton.Root>
```

#### AboutDialog

An application about dialog.

```tsx
{
  showAbout && (
    <AboutDialog
      programName="My App"
      version="1.0.0"
      comments="A sample application"
      onCloseRequest={() => {
        setShowAbout(false);
        return false;
      }}
    />
  );
}
```

### Chooser Widgets

#### ColorDialogButton

Opens a color picker dialog.

```tsx
<ColorDialogButton />
```

#### FontDialogButton

Opens a font picker dialog.

```tsx
<FontDialogButton />
```

#### EmojiChooser

A popover for selecting emojis.

```tsx
<EmojiChooser onEmojiPicked={(emoji) => console.log(emoji)} />
```

### Other Widgets

#### Calendar

A date picker.

```tsx
<Calendar onDaySelected={handleDateChange} />
```

#### Expander

A collapsible container.

```tsx
<Expander.Root label="Click to expand">
  <Expander.Child>
    <Box>{/* Hidden content */}</Box>
  </Expander.Child>
</Expander.Root>
```

#### Revealer

Animates showing/hiding content.

```tsx
<Revealer
  revealChild={visible}
  transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
>
  <Label.Root label="Revealed content" />
</Revealer>
```

#### Overlay

Stacks widgets on top of each other.

```tsx
<Overlay>
  <Box>{/* Base content */}</Box>
  <Label.Root label="On top" halign={Gtk.Align.END} valign={Gtk.Align.START} />
</Overlay>
```

#### Separator

A horizontal or vertical line separator.

```tsx
<Separator />
```

## Hooks Support

GTKX fully supports React hooks:

```tsx
import { useState, useEffect } from "react";
import { ApplicationWindow, Button, Label, Box, quit, render } from "@gtkx/gtkx";

const Counter = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(`Count changed to ${count}`);
  }, [count]);

  return (
    <Box spacing={10}>
      <Label.Root label={`Count: ${count}`} />
      <Button label="Increment" onClicked={() => setCount((c) => c + 1)} />
    </Box>
  );
};

render(
  <ApplicationWindow title="Counter" onCloseRequest={quit}>
    <Counter />
  </ApplicationWindow>,
  "com.example.counter"
);
```

## Named Slots

Some GTK widgets have named child positions. GTKX handles these using compound components:

```tsx
// Frame with a custom label widget
<Frame.Root>
  <Frame.LabelWidget>
    <Label.Root label="Custom Label" />
  </Frame.LabelWidget>
  <Frame.Child>
    <Box>{/* Main content */}</Box>
  </Frame.Child>
</Frame.Root>

// CenterBox with start, center, and end widgets
<CenterBox.Root>
  <CenterBox.StartWidget>{/* Left */}</CenterBox.StartWidget>
  <CenterBox.CenterWidget>{/* Center */}</CenterBox.CenterWidget>
  <CenterBox.EndWidget>{/* Right */}</CenterBox.EndWidget>
</CenterBox.Root>
```

## Using GTK Enums

Import enums from `@gtkx/ffi/gtk`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<Box orientation={Gtk.Orientation.VERTICAL} />;
<ListBox selectionMode={Gtk.SelectionMode.SINGLE} />;
<Revealer transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN} />;
<Label.Root halign={Gtk.Align.CENTER} />;
```

## Architecture

GTKX uses a multi-layer architecture:

```
┌─────────────────────────────────┐
│     Your React Application      │
├─────────────────────────────────┤
│   @gtkx/gtkx (React Reconciler) │
├─────────────────────────────────┤
│      @gtkx/ffi (FFI Bindings)   │
├─────────────────────────────────┤
│    @gtkx/native (Rust Bridge)   │
├─────────────────────────────────┤
│           GTK4 / GLib           │
└─────────────────────────────────┘
```

1. **React Application** — Your JSX components with hooks and state
2. **React Reconciler** — Translates React operations to GTK widget updates
3. **FFI Bindings** — TypeScript classes wrapping GTK C functions
4. **Native Bridge** — Rust module using libffi to call GTK
5. **GTK4** — The native Linux GUI toolkit

## License

[MPL-2.0](../../LICENSE)
