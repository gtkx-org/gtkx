---
sidebar_position: 1
sidebar_label: Slots
---

# Slots

GTK widgets often have named child properties like `titleWidget`, `child`, or `label`. GTKX exposes these as **slots** — special components that place children into specific widget properties rather than generic child containers.

## Basic Usage

Slots follow the pattern `<Widget.SlotName>`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkExpander, GtkBox, GtkLabel } from "@gtkx/react";

const ExpandableSection = () => (
  <GtkExpander.Root label="Click to expand">
    <GtkExpander.Child>
      <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        This content is inside the expander
        It shows when expanded
      </GtkBox>
    </GtkExpander.Child>
  </GtkExpander.Root>
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
import { GtkFrame } from "@gtkx/react";

<GtkFrame.Root label="Settings">
  <GtkFrame.Child>Frame content goes here</GtkFrame.Child>
</GtkFrame.Root>;
```

### HeaderBar with Title Widget

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkHeaderBar, GtkLabel, GtkBox } from "@gtkx/react";

<GtkHeaderBar.Root>
  <GtkHeaderBar.TitleWidget>
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
      <GtkLabel label="My App" cssClasses={["heading"]} />
      <GtkLabel label="v1.0" cssClasses={["dim-label"]} />
    </GtkBox>
  </GtkHeaderBar.TitleWidget>
</GtkHeaderBar.Root>;
```

### Window with Titlebar

```tsx
import { GtkWindow, GtkHeaderBar, GtkButton, quit } from "@gtkx/react";

<GtkWindow.Root onCloseRequest={quit}>
  <GtkWindow.Titlebar>
    <GtkHeaderBar.Root>
      <GtkButton label="Menu" />
    </GtkHeaderBar.Root>
  </GtkWindow.Titlebar>
  <GtkWindow.Child>{/* Main content */}</GtkWindow.Child>
</GtkWindow.Root>;
```

### Adwaita Toolbar View

`AdwToolbarView` uses slots for top bars, bottom bars, and main content:

```tsx
import {
  AdwToolbarView,
  AdwHeaderBar,
  AdwWindowTitle,
  GtkLabel,
} from "@gtkx/react";

<AdwToolbarView.Root>
  <AdwToolbarView.Top>
    <AdwHeaderBar.Root>
      <AdwHeaderBar.TitleWidget>
        <AdwWindowTitle title="My App" subtitle="Welcome" />
      </AdwHeaderBar.TitleWidget>
    </AdwHeaderBar.Root>
  </AdwToolbarView.Top>
  <AdwToolbarView.Content>Main content</AdwToolbarView.Content>
  <AdwToolbarView.Bottom>{/* Optional bottom toolbar */}</AdwToolbarView.Bottom>
</AdwToolbarView.Root>;
```

### Adwaita Application Window

`AdwApplicationWindow` requires content to be placed in a slot:

```tsx
import { AdwApplicationWindow, quit } from "@gtkx/react";

<AdwApplicationWindow.Root onCloseRequest={quit}>
  <AdwApplicationWindow.Content>
    {/* Your app content */}
  </AdwApplicationWindow.Content>
</AdwApplicationWindow.Root>;
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

`Label` is commonly used as a slot value for custom widget titles:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkExpander, GtkLabel, GtkBox } from "@gtkx/react";

// Expander with a custom label widget using markup
<GtkExpander.Root>
  <GtkExpander.LabelWidget>
    <GtkLabel label="<b>Bold</b> title" useMarkup />
  </GtkExpander.LabelWidget>
  <GtkExpander.Child>
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      Content inside the expander
    </GtkBox>
  </GtkExpander.Child>
</GtkExpander.Root>
```

## Dynamic Slot Content

Slots work with React's conditional rendering:

```tsx
import { GtkExpander, GtkLabel, GtkSpinner } from "@gtkx/react";

const LoadingExpander = ({ loading, data }) => (
  <GtkExpander.Root label="Data">
    <GtkExpander.Child>
      {loading ? <GtkSpinner spinning /> : <GtkLabel label={data} />}
    </GtkExpander.Child>
  </GtkExpander.Root>
);
```

When the condition changes, GTKX automatically calls the appropriate setter to swap the slot content.
