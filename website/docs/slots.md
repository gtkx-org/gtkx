# Slots

GTK widgets sometimes have designated "slots" — named positions where you place child widgets. Unlike regular children that append to a container, slots set specific widget properties.

## Understanding Slots

In GTK, some widgets have properties that accept a single widget rather than a list of children. For example:

- `GtkMenuButton` has a `popover` property for its popup content
- `GtkHeaderBar` has a `titleWidget` property for a custom title
- `GtkPaned` has `startChild` and `endChild` properties

GTKX provides `x.Slot` to set these properties declaratively.

## Basic Usage

```tsx
import { x, GtkHeaderBar, GtkLabel } from "@gtkx/react";

<GtkHeaderBar>
 <x.Slot for={GtkHeaderBar} id="titleWidget">
 <GtkLabel label="Custom Title" cssClasses={["title"]} />
 </x.Slot>
</GtkHeaderBar>
```

The `x.Slot` component:
1. Takes a `for` prop specifying the widget type
2. Takes an `id` prop specifying the slot name (camelCase)
3. Accepts a single child widget

## Common Slots

### GtkHeaderBar

```tsx
<GtkHeaderBar>
 {/* Custom title widget */}
 <x.Slot for={GtkHeaderBar} id="titleWidget">
 <GtkLabel label="My App" cssClasses={["title"]} />
 </x.Slot>

 {/* Regular children go to start/end */}
 <GtkButton iconName="open-menu-symbolic" />
</GtkHeaderBar>
```

### GtkMenuButton

```tsx
<GtkMenuButton label="Open">
 <x.Slot for={GtkMenuButton} id="popover">
 <GtkPopover>
 <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
 Popover content
 <GtkButton label="Action" />
 </GtkBox>
 </GtkPopover>
 </x.Slot>
</GtkMenuButton>
```

### GtkPaned

Split view with two panes:

```tsx
import { x, GtkPaned } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<GtkPaned position={200}>
 <x.Slot for={GtkPaned} id="startChild">
 <Sidebar />
 </x.Slot>
 <x.Slot for={GtkPaned} id="endChild">
 <ContentArea />
 </x.Slot>
</GtkPaned>
```

### GtkOverlay

Layer widgets on top of each other:

```tsx
import { x, GtkOverlay, GtkImage, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<GtkOverlay>
 {/* Base content as direct child */}
 <GtkImage file="background.png" />

 {/* Overlay content using x.OverlayChild element */}
 <x.OverlayChild>
 <GtkLabel
 label="Overlaid text"
 cssClasses={["title-1"]}
 halign={Gtk.Align.END}
 valign={Gtk.Align.END}
 marginEnd={12}
 marginBottom={12}
 />
 </x.OverlayChild>
</GtkOverlay>
```

The `x.OverlayChild` element supports `measure` and `clipOverlay` props to control overlay behavior.

### GtkExpander

```tsx
import { GtkExpander, GtkLabel } from "@gtkx/react";

<GtkExpander label="Show Details">
 <GtkLabel label="Hidden content revealed when expanded" />
</GtkExpander>
```

## Nested Panes Example

```tsx
import { x, GtkPaned, GtkBox } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const ThreePaneLayout = () => (
 <GtkPaned position={200}>
 <x.Slot for={GtkPaned} id="startChild">
 <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["sidebar"]}>
 Sidebar
 </GtkBox>
 </x.Slot>
 <x.Slot for={GtkPaned} id="endChild">
 <GtkPaned orientation={Gtk.Orientation.VERTICAL} position={400}>
 <x.Slot for={GtkPaned} id="startChild">
 <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["content"]}>
 Main Content
 </GtkBox>
 </x.Slot>
 <x.Slot for={GtkPaned} id="endChild">
 <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["panel"]}>
 Bottom Panel
 </GtkBox>
 </x.Slot>
 </GtkPaned>
 </x.Slot>
 </GtkPaned>
);
```

## When to Use Slots

Use `x.Slot` when:
- A widget has a named property that accepts a widget (like `popover`, `titleWidget`)
- You need to place content in a specific position (`startChild`, `endChild`)
- The GTK documentation mentions a widget property rather than child packing

Don't use `x.Slot` when:
- Adding regular children to a container (just use JSX children)
- The widget uses standard child packing (`GtkBox`, `GtkListBox`)
