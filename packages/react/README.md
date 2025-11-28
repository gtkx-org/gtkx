# @gtkx/react

React integration layer for GTKX. This package provides a custom React reconciler that renders React components as native GTK4 widgets.

## Installation

```bash
pnpm add @gtkx/react react
```

### Peer Dependencies

- `react` ^19.0.0

### System Requirements

- Linux with GTK4 libraries
- Node.js 20+
- Rust toolchain (for building `@gtkx/native`)

```bash
# Fedora
sudo dnf install gtk4-devel

# Ubuntu/Debian
sudo apt install libgtk-4-dev
```

## Quick Start

```tsx
import { ApplicationWindow, Button, Box, Label, quit, render } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <Box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} spacing={10}>
      <Label.Root label={`Count: ${count}`} cssClasses={["title-2"]} />
      <Button label="Increment" onClicked={() => setCount(c => c + 1)} />
    </Box>
  );
};

// Export app instance for use in dialogs
export const app = render(
  <ApplicationWindow title="My App" defaultWidth={800} defaultHeight={600} onCloseRequest={quit}>
    <Counter />
  </ApplicationWindow>,
  "com.example.myapp"
);
```

Run with:

```bash
npx tsx src/index.tsx
```

## API

### `render(element, applicationId)`

Renders a React element tree as a GTK4 application. Returns the GTK Application instance.

- `element` — Root React element (typically `ApplicationWindow`)
- `applicationId` — Unique identifier in reverse-DNS format (e.g., `com.example.app`)

```tsx
export const app = render(<App />, "com.example.myapp");
```

### `quit()`

Signals the application to close. Returns `false` (useful as a direct event handler for `onCloseRequest`).

```tsx
<ApplicationWindow onCloseRequest={quit}>...</ApplicationWindow>
```

### `createPortal(element)`

Renders a React element outside the normal component tree (useful for dialogs).

```tsx
{showDialog && createPortal(<AboutDialog ... />)}
```

### `createRef()`

Creates a reference for FFI output parameters.

```tsx
import { createRef } from "@gtkx/react";

const ref = createRef();
someGtkFunction(ref);
console.log(ref.value);
```

## Widgets

### Container Widgets

**ApplicationWindow** — Main application window

```tsx
<ApplicationWindow title="Window Title" defaultWidth={800} defaultHeight={600} onCloseRequest={quit}>
  {children}
</ApplicationWindow>
```

**Box** — Arranges children in a row or column

```tsx
<Box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
  <Button label="First" />
  <Button label="Second" />
</Box>
```

**Grid** — Arranges children in a grid layout

```tsx
<Grid.Root columnSpacing={10} rowSpacing={10}>
  <Grid.Child column={0} row={0}><Button label="(0,0)" /></Grid.Child>
  <Grid.Child column={1} row={0}><Button label="(1,0)" /></Grid.Child>
  <Grid.Child column={0} row={1} columnSpan={2}>
    <Button label="Spans 2 columns" hexpand />
  </Grid.Child>
</Grid.Root>
```

**ScrolledWindow** — Adds scrollbars to content

```tsx
<ScrolledWindow vexpand hexpand>
  <TextView />
</ScrolledWindow>
```

**Paned** — Resizable split container

```tsx
<Paned.Root wideHandle>
  <Paned.StartChild>
    <Box>{/* Left */}</Box>
  </Paned.StartChild>
  <Paned.EndChild>
    <Box>{/* Right */}</Box>
  </Paned.EndChild>
</Paned.Root>
```

### Input Widgets

**Button** — Clickable button

```tsx
<Button label="Click me" onClicked={() => console.log("Clicked!")} />
```

**ToggleButton** — Button with on/off state

```tsx
<ToggleButton.Root label={active ? "ON" : "OFF"} active={active} onToggled={() => setActive(a => !a)} />
```

**CheckButton** — Checkbox with label

```tsx
<CheckButton.Root label="Accept terms" active={checked} onToggled={() => setChecked(c => !c)} />
```

**Switch** — On/off toggle (must return `true` from `onStateSet`)

```tsx
<Switch
  active={enabled}
  onStateSet={() => {
    setEnabled(e => !e);
    return true;
  }}
/>
```

**Entry** — Single-line text input

```tsx
<Entry placeholderText="Enter text..." />
<PasswordEntry placeholderText="Password..." />
<SearchEntry placeholderText="Search..." />
```

**SpinButton** — Numeric input with increment/decrement

```tsx
const adjustment = useRef(new Gtk.Adjustment({ value: 50, lower: 0, upper: 100, stepIncrement: 1 }));
<SpinButton adjustment={adjustment.current.ptr} onValueChanged={() => setValue(adjustment.current.getValue())} />
```

**Scale** — Horizontal or vertical slider

```tsx
<Scale hexpand drawValue adjustment={adjustment.current.ptr} />
```

### Display Widgets

**Label** — Text display

```tsx
<Label.Root label="Hello, World!" cssClasses={["title-2"]} />
```

**ProgressBar** — Progress indicator

```tsx
<ProgressBar fraction={0.5} showText />
```

**Spinner** — Loading indicator

```tsx
<Spinner spinning={isLoading} />
```

### Layout Widgets

**HeaderBar** — Title bar with buttons

```tsx
<HeaderBar.Root>
  <HeaderBar.TitleWidget>
    <Label.Root label="App Title" />
  </HeaderBar.TitleWidget>
</HeaderBar.Root>
```

**CenterBox** — Positions children at start, center, and end

```tsx
<CenterBox.Root>
  <CenterBox.StartWidget><Button label="Left" /></CenterBox.StartWidget>
  <CenterBox.CenterWidget><Label.Root label="Center" /></CenterBox.CenterWidget>
  <CenterBox.EndWidget><Button label="Right" /></CenterBox.EndWidget>
</CenterBox.Root>
```

### List Widgets

**ListBox** — Simple vertical list

```tsx
<ListBox selectionMode={Gtk.SelectionMode.SINGLE}>
  <ListBoxRow><Label.Root label="Item 1" /></ListBoxRow>
  <ListBoxRow><Label.Root label="Item 2" /></ListBoxRow>
</ListBox>
```

**DropDown** — Dropdown selector

```tsx
<DropDown.Root
  itemLabel={(item) => item.name}
  onSelectionChanged={(item, index) => setSelected(item)}
>
  {items.map(item => <DropDown.Item key={item.id} item={item} />)}
</DropDown.Root>
```

**ListView** — Virtualized list for large datasets

```tsx
<ListView.Root renderItem={(item) => {
  if (!item) return new Gtk.Box();
  return new Gtk.Label({ label: item.name });
}}>
  {items.map(item => <ListView.Item item={item} key={item.id} />)}
</ListView.Root>
```

### Dialog Widgets

**AboutDialog** — Application about dialog (React component)

```tsx
{showAbout && createPortal(
  <AboutDialog
    programName="My App"
    version="1.0.0"
    onCloseRequest={() => { setShowAbout(false); return false; }}
  />
)}
```

**Async Dialogs** — AlertDialog, FileDialog, ColorDialog, FontDialog (imperative)

```tsx
import { app } from "./index.js";

const openFile = async () => {
  const dialog = new Gtk.FileDialog();
  dialog.setTitle("Open File");
  try {
    const file = await dialog.open(app.getActiveWindow());
    console.log(file.getPath());
  } catch {
    // Cancelled
  }
};
```

## Named Slots

Some GTK widgets have named child positions, handled via compound components:

```tsx
<Frame.Root>
  <Frame.LabelWidget>
    <Label.Root label="Custom Label" />
  </Frame.LabelWidget>
  <Frame.Child>
    <Box>{/* Content */}</Box>
  </Frame.Child>
</Frame.Root>

<Expander.Root label="Click to expand">
  <Expander.Child>
    <Box>Hidden content</Box>
  </Expander.Child>
</Expander.Root>
```

## Using GTK Enums

Import enums from `@gtkx/ffi/gtk`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<Box orientation={Gtk.Orientation.VERTICAL} />
<ListBox selectionMode={Gtk.SelectionMode.SINGLE} />
<Revealer transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN} />
```

## Hooks Support

Standard React hooks work as expected:

```tsx
import { useState, useEffect, useRef } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(`Count: ${count}`);
  }, [count]);

  return (
    <Box spacing={10}>
      <Label.Root label={`Count: ${count}`} />
      <Button label="Increment" onClicked={() => setCount(c => c + 1)} />
    </Box>
  );
};
```

## Architecture

```
┌─────────────────────────────────┐
│     Your React Application      │
├─────────────────────────────────┤
│   @gtkx/react (React Reconciler) │
├─────────────────────────────────┤
│   @gtkx/ffi (TypeScript FFI)    │
├─────────────────────────────────┤
│   @gtkx/native (Rust Bridge)    │
├─────────────────────────────────┤
│         GTK4 / GLib             │
└─────────────────────────────────┘
```

## License

[MPL-2.0](../../LICENSE)
