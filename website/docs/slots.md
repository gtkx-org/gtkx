# Slots

GTK widgets sometimes have designated "slots" — named positions where you place child widgets. Unlike regular children that append to a container, slots set specific widget properties.

## Understanding Slots

In GTK, some widgets have properties that accept a single widget rather than a list of children. For example:

- `GtkMenuButton` has a `popover` property for its popup content
- `GtkHeaderBar` has a `titleWidget` property for a custom title
- `GtkPaned` has `startChild` and `endChild` properties

GTKX provides the `Slot` component to set these properties declaratively.

## Basic Usage

```tsx
import { GtkHeaderBar, GtkLabel, Slot } from "@gtkx/react";

<GtkHeaderBar>
    <Slot for={GtkHeaderBar} id="titleWidget">
        <GtkLabel label="Custom Title" cssClasses={["title"]} />
    </Slot>
</GtkHeaderBar>
```

The `Slot` component:
1. Takes a `for` prop specifying the widget type
2. Takes an `id` prop specifying the slot name (camelCase)
3. Accepts a single child widget

## Common Slots

### GtkHeaderBar

```tsx
<GtkHeaderBar>
    {/* Custom title widget */}
    <Slot for={GtkHeaderBar} id="titleWidget">
        <GtkLabel label="My App" cssClasses={["title"]} />
    </Slot>

    {/* Regular children go to start/end */}
    <GtkButton iconName="open-menu-symbolic" />
</GtkHeaderBar>
```

### GtkMenuButton

```tsx
<GtkMenuButton label="Open">
    <Slot for={GtkMenuButton} id="popover">
        <GtkPopover>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                Popover content
                <GtkButton label="Action" />
            </GtkBox>
        </GtkPopover>
    </Slot>
</GtkMenuButton>
```

### GtkPaned

Split view with two panes:

```tsx
import { GtkPaned, Slot } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<GtkPaned orientation={Gtk.Orientation.HORIZONTAL} position={200}>
    <Slot for={GtkPaned} id="startChild">
        <Sidebar />
    </Slot>
    <Slot for={GtkPaned} id="endChild">
        <ContentArea />
    </Slot>
</GtkPaned>
```

### GtkOverlay

Layer widgets on top of each other:

```tsx
import { GtkOverlay, GtkLabel, GtkButton, Slot } from "@gtkx/react";

<GtkOverlay>
    {/* Base content */}
    <Slot for={GtkOverlay} id="child">
        <GtkImage file="background.png" />
    </Slot>

    {/* Overlay content (added with addOverlay) */}
    <GtkButton
        label="Floating Button"
        halign={Gtk.Align.END}
        valign={Gtk.Align.END}
        marginEnd={12}
        marginBottom={12}
    />
</GtkOverlay>
```

### GtkExpander

```tsx
import { GtkExpander, Slot } from "@gtkx/react";

<GtkExpander label="Show Details">
    <Slot for={GtkExpander} id="child">
        Hidden content revealed when expanded
    </Slot>
</GtkExpander>
```

## Nested Panes Example

```tsx
import { GtkPaned, GtkBox, Slot } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const ThreePaneLayout = () => (
    <GtkPaned orientation={Gtk.Orientation.HORIZONTAL} position={200}>
        <Slot for={GtkPaned} id="startChild">
            <GtkBox cssClasses={["sidebar"]}>
                Sidebar
            </GtkBox>
        </Slot>
        <Slot for={GtkPaned} id="endChild">
            <GtkPaned orientation={Gtk.Orientation.VERTICAL} position={400}>
                <Slot for={GtkPaned} id="startChild">
                    <GtkBox cssClasses={["content"]}>
                        Main Content
                    </GtkBox>
                </Slot>
                <Slot for={GtkPaned} id="endChild">
                    <GtkBox cssClasses={["panel"]}>
                        Bottom Panel
                    </GtkBox>
                </Slot>
            </GtkPaned>
        </Slot>
    </GtkPaned>
);
```

## When to Use Slots

Use `Slot` when:
- A widget has a named property that accepts a widget (like `popover`, `titleWidget`)
- You need to place content in a specific position (`startChild`, `endChild`)
- The GTK documentation mentions a widget property rather than child packing

Don't use `Slot` when:
- Adding regular children to a container (just use JSX children)
- The widget uses standard child packing (`GtkBox`, `GtkListBox`)

## Slot Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `for` | `ComponentType` | The widget type that owns the slot |
| `id` | `string` | The slot name (camelCase property name) |
| `children` | `ReactNode` | Single child widget |
