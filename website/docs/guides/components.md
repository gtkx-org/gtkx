---
sidebar_position: 1
---

# Components Guide

GTKX provides React components for GTK4 widgets. This guide covers the core patterns and concepts.

## Core API

### render

The main entry point for GTKX applications:

```tsx
import { ApplicationWindow, Button, quit, render } from "@gtkx/gtkx";

render(
  <ApplicationWindow
    title="My App"
    defaultWidth={800}
    defaultHeight={600}
    onCloseRequest={quit}
  >
    <Button label="Hello" onClicked={() => console.log("Clicked!")} />
  </ApplicationWindow>,
  "com.example.app"
);
```

The `render` function:
- Takes a React element tree as the first argument
- Takes an application ID as the second argument (reverse domain notation)
- Optionally accepts `ApplicationFlags` as the third argument
- Starts the GTK main loop

### quit

Cleanly shuts down the application:

```tsx
import { quit } from "@gtkx/gtkx";

<ApplicationWindow onCloseRequest={quit}>
  {/* Content */}
</ApplicationWindow>
```

The `quit` function:
- Unmounts the React tree
- Stops the GTK main loop
- Returns `false` (can be used directly as an event handler)

### createPortal

Renders children into a different widget container:

```tsx
import { createPortal } from "@gtkx/gtkx";
import type * as Gtk from "@gtkx/ffi/gtk";

function MyComponent() {
  const containerRef = useRef<Gtk.Box>(null);

  return (
    <>
      <Box ref={containerRef} />
      {containerRef.current && createPortal(
        <Label label="Rendered in the Box" />,
        containerRef.current
      )}
    </>
  );
}
```

### createRef

Creates references for callback-based GTK APIs:

```tsx
import { createRef } from "@gtkx/gtkx";

const ref = createRef(myValue);
```

## Property Conventions

### Naming

GTK uses snake_case; GTKX converts to camelCase:

| GTK Property | GTKX Prop |
|--------------|-----------|
| `default_width` | `defaultWidth` |
| `margin_start` | `marginStart` |
| `tooltip_text` | `tooltipText` |
| `css_classes` | `cssClasses` |

### Common Properties

Most widgets support these properties:

| Prop | Type | Description |
|------|------|-------------|
| `hexpand` | boolean | Expand horizontally |
| `vexpand` | boolean | Expand vertically |
| `halign` | Gtk.Align | Horizontal alignment |
| `valign` | Gtk.Align | Vertical alignment |
| `marginTop` | number | Top margin in pixels |
| `marginBottom` | number | Bottom margin |
| `marginStart` | number | Start margin (left in LTR) |
| `marginEnd` | number | End margin (right in LTR) |
| `cssClasses` | string[] | CSS class names |
| `tooltipText` | string | Tooltip text |
| `sensitive` | boolean | Whether widget is interactive |
| `visible` | boolean | Whether widget is visible |

### Using GTK Enums

Import enums from `@gtkx/ffi/gtk`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<Box orientation={Gtk.Orientation.VERTICAL} />
<ListBox selectionMode={Gtk.SelectionMode.SINGLE} />
<Revealer transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN} />
```

## Component Patterns

### Simple Components

Basic widgets accept props directly:

```tsx
<Button label="Click me" onClicked={() => {}} />
<Label label="Hello, World!" />
<Spinner spinning={true} />
```

### Compound Components

Widgets with named child slots use a compound pattern with `.Root` and slot components:

```tsx
<HeaderBar.Root>
  <HeaderBar.TitleWidget>
    <Label.Root label="My App" />
  </HeaderBar.TitleWidget>
  <HeaderBar.Start>
    <Button label="Back" />
  </HeaderBar.Start>
  <HeaderBar.End>
    <Button label="Menu" />
  </HeaderBar.End>
</HeaderBar.Root>
```

This pattern maps to GTK widgets that have named child properties (like HeaderBar's title widget, start/end widgets).

Other examples:

```tsx
// CenterBox with three slots
<CenterBox.Root hexpand>
  <CenterBox.StartWidget>
    <Button label="Start" />
  </CenterBox.StartWidget>
  <CenterBox.CenterWidget>
    <Label.Root label="Center" />
  </CenterBox.CenterWidget>
  <CenterBox.EndWidget>
    <Button label="End" />
  </CenterBox.EndWidget>
</CenterBox.Root>

// Frame with label and child
<Frame.Root>
  <Frame.LabelWidget>
    <Label.Root label="Settings" />
  </Frame.LabelWidget>
  <Frame.Child>
    <Box>{/* Content */}</Box>
  </Frame.Child>
</Frame.Root>

// Expander with collapsible content
<Expander.Root label="Show more">
  <Expander.Child>
    <Label.Root label="Hidden content" />
  </Expander.Child>
</Expander.Root>
```

### Container Components

Containers accept children directly:

```tsx
<Box spacing={10}>
  <Button label="A" />
  <Button label="B" />
</Box>

<ScrolledWindow vexpand hexpand>
  {/* Scrollable content */}
</ScrolledWindow>
```

## Layout

### Box Layout

Horizontal or vertical arrangement:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

// Horizontal (default)
<Box spacing={10}>
  <Button label="A" />
  <Button label="B" />
</Box>

// Vertical
<Box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
  <Button label="A" />
  <Button label="B" />
</Box>
```

### Grid Layout

For precise 2D positioning with rows and columns:

```tsx
<Grid.Root rowSpacing={10} columnSpacing={10} hexpand>
  <Grid.Child column={0} row={0}>
    <Button label="Top Left" hexpand />
  </Grid.Child>
  <Grid.Child column={1} row={0}>
    <Button label="Top Right" hexpand />
  </Grid.Child>
  <Grid.Child column={0} row={1}>
    <Button label="Bottom Left" hexpand />
  </Grid.Child>
  <Grid.Child column={1} row={1}>
    <Button label="Bottom Right" hexpand />
  </Grid.Child>
  <Grid.Child column={0} row={2} columnSpan={2}>
    <Button label="Full Width (spans 2 columns)" hexpand />
  </Grid.Child>
</Grid.Root>
```

Grid.Child props:
- `column`: Column index (0-based)
- `row`: Row index (0-based)
- `columnSpan`: Number of columns to span (default: 1)
- `rowSpan`: Number of rows to span (default: 1)

### Expansion and Alignment

Control how widgets fill space:

```tsx
// Expand to fill available space
<Box hexpand vexpand>
  <Label.Root label="Fills the space" hexpand vexpand />
</Box>

// Align within allocated space
<Label.Root
  label="Centered"
  halign={Gtk.Align.CENTER}
  valign={Gtk.Align.CENTER}
/>
```

### Margins and Spacing

```tsx
<Box spacing={10}>
  <Label.Root
    label="With margins"
    marginTop={20}
    marginBottom={20}
    marginStart={10}
    marginEnd={10}
  />
</Box>
```

## Text Display

GTKX supports React text nodes, which are automatically rendered as GTK Labels:

```tsx
// Text nodes work directly
<Box>Hello World</Box>

// Equivalent to
<Box>
  <Label label="Hello World" />
</Box>
```

You can also use dynamic text:

```tsx
const [name, setName] = useState("World");

<Box>Hello, {name}!</Box>
```

For more control over text styling, use the Label component directly with its full set of props.

## Conditional Rendering

Standard React conditional rendering works:

```tsx
const [showExtra, setShowExtra] = useState(false);

<Box>
  <Button label="Toggle" onClicked={() => setShowExtra(s => !s)} />
  {showExtra && <Label.Root label="Extra content" />}
</Box>
```

## Lists and Iteration

Map arrays to components with keys:

```tsx
const items = [
  { id: 1, name: "Apple" },
  { id: 2, name: "Banana" },
];

<ListBox>
  {items.map(item => (
    <ListBoxRow key={item.id}>
      <Label.Root label={item.name} />
    </ListBoxRow>
  ))}
</ListBox>
```

## Refs

Access underlying GTK widget instances with proper typing:

```tsx
import type * as Gtk from "@gtkx/ffi/gtk";

const buttonRef = useRef<Gtk.Button>(null);

<Button ref={buttonRef} label="Click me" />

// Later, access the GTK widget
if (buttonRef.current) {
  buttonRef.current.setLabel("Updated");
}
```

Each component's ref is typed to its corresponding GTK class from `@gtkx/ffi/gtk`:

| Component | Ref Type |
|-----------|----------|
| `Button` | `Gtk.Button` |
| `Label` | `Gtk.Label` |
| `Entry` | `Gtk.Entry` |
| `Box` | `Gtk.Box` |
| `ApplicationWindow` | `Gtk.ApplicationWindow` |
