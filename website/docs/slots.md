---
sidebar_position: 1
sidebar_label: Slots
---

# Slots

GTK widgets often have named child properties like `titleWidget`, `child`, or `label`. GTKX exposes these as **slots** — special components that place children into specific widget properties rather than generic child containers.

## Basic Usage

Slots follow the pattern `<Widget.SlotName>`:

```tsx
import { Expander, Box, Label } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

const ExpandableSection = () => (
  <Expander.Root label="Click to expand">
    <Expander.Child>
      <Box orientation={Orientation.VERTICAL} spacing={8}>
        <Label.Root label="This content is inside the expander" />
        <Label.Root label="It shows when expanded" />
      </Box>
    </Expander.Child>
  </Expander.Root>
);
```

The `<Expander.Child>` slot calls `expander.setChild(widget)` internally, placing the content in the expander's designated child area.

## How Slots Work

Slots are virtual nodes — they don't create GTK widgets themselves. Instead, they:

1. Receive children from React
2. Call the appropriate setter on the parent widget (e.g., `setChild`, `setTitleWidget`)
3. Call the setter with `null` when unmounted

This maps React's composition model to GTK's property-based child management.

## Common Slot Patterns

### Frame with Child

```tsx
import { Frame, Label } from "@gtkx/react";

<Frame.Root label="Settings">
  <Frame.Child>
    <Label.Root label="Frame content goes here" />
  </Frame.Child>
</Frame.Root>
```

### HeaderBar with Title Widget

```tsx
import { HeaderBar, Label, Box } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

<HeaderBar.Root>
  <HeaderBar.TitleWidget>
    <Box orientation={Orientation.HORIZONTAL} spacing={8}>
      <Label.Root label="My App" cssClasses={["heading"]} />
      <Label.Root label="v1.0" cssClasses={["dim-label"]} />
    </Box>
  </HeaderBar.TitleWidget>
</HeaderBar.Root>
```

### Window with Titlebar

```tsx
import { Window, HeaderBar, Button, quit } from "@gtkx/react";

<Window.Root onCloseRequest={quit}>
  <Window.Titlebar>
    <HeaderBar.Root>
      <Button label="Menu" />
    </HeaderBar.Root>
  </Window.Titlebar>
  <Window.Child>
    {/* Main content */}
  </Window.Child>
</Window.Root>
```

## Root vs Slot Components

Every widget with slots has two component types:

- **`Widget.Root`** — The actual GTK widget (creates the widget instance)
- **`Widget.SlotName`** — Named slots for specific child properties (virtual, no widget created)

```tsx
// Expander.Root creates the GtkExpander widget
// Expander.Child places content into the expander's "child" property
<Expander.Root label="Title">
  <Expander.Child>
    <Content />
  </Expander.Child>
</Expander.Root>
```

## Labels as Slots

`Label.Root` is a special case — it's both a widget and commonly used as a slot value:

```tsx
import { Label, Button } from "@gtkx/react";

// Label as a standalone widget
<Label.Root label="Hello, World!" />

// Button with custom label widget (uses Label internally)
<Button>
  <Button.Child>
    <Label.Root label="<b>Bold</b> button" useMarkup />
  </Button.Child>
</Button>
```

## Dynamic Slot Content

Slots work with React's conditional rendering:

```tsx
import { Expander, Label, Spinner } from "@gtkx/react";

const LoadingExpander = ({ loading, data }) => (
  <Expander.Root label="Data">
    <Expander.Child>
      {loading ? (
        <Spinner spinning />
      ) : (
        <Label.Root label={data} />
      )}
    </Expander.Child>
  </Expander.Root>
);
```

When the condition changes, GTKX automatically calls the appropriate setter to swap the slot content.
