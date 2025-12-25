---
sidebar_position: 5
---

# Slots

GTK widgets often have named properties that accept child widgets, such as `titlebar`, `child`, or `titleWidget`. The `Slot` component lets you set these properties declaratively.

## Basic Usage

Use `<Slot id="propertyName">` to place a child widget into a parent's property:

```tsx
import { GtkWindow, GtkHeaderBar, GtkBox, Slot } from '@gtkx/react';

<GtkWindow>
    <Slot id="titlebar">
        <GtkHeaderBar />
    </Slot>
    <GtkBox>
        Main window content
    </GtkBox>
</GtkWindow>
```

The `id` corresponds to the property name in camelCase. This example calls `window.setTitlebar(headerbar)`.

## How Slots Work

Slots are virtual nodes that:

1. Accept a single child widget
2. Call the parent's property setter (e.g., `setTitlebar`, `setChild`)
3. Clear the property (set to `null`) when unmounted

This maps React's composition model to GTK's property-based widget attachment.

## Type-Safe Slots

Use the `for` prop to get type-safe slot IDs with autocomplete:

```tsx
import { GtkWindow, GtkHeaderBar, Slot } from '@gtkx/react';

<GtkWindow>
    <Slot for={GtkWindow} id="titlebar">
        <GtkHeaderBar />
    </Slot>
</GtkWindow>
```

The `for` prop accepts a component type and restricts `id` to valid slot names for that widget.

## Common Slot Patterns

### Window Titlebar

Replace the default titlebar with a custom header:

```tsx
<GtkWindow>
    <Slot id="titlebar">
        <GtkHeaderBar>
            <GtkButton label="Menu" />
        </GtkHeaderBar>
    </Slot>
    Content
</GtkWindow>
```

### HeaderBar Widgets

Add widgets to the start or end of a header bar:

```tsx
<GtkHeaderBar>
    <Slot id="titleWidget">
        <GtkLabel label="Custom Title" cssClasses={['title']} />
    </Slot>
</GtkHeaderBar>
```

Note: For HeaderBar start/end widgets, use the `Pack` components instead of slots. See [Packing](#packing).

### Expander with Custom Label

```tsx
<GtkExpander>
    <Slot id="labelWidget">
        <GtkLabel label="<b>Bold Title</b>" useMarkup={true} />
    </Slot>
    <Slot id="child">
        <GtkBox>
            Expandable content
        </GtkBox>
    </Slot>
</GtkExpander>
```

### Button with Custom Child

Replace a button's label with a custom widget:

```tsx
<GtkButton>
    <Slot id="child">
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
            <GtkImage iconName="document-save-symbolic" />
            <GtkLabel label="Save" />
        </GtkBox>
    </Slot>
</GtkButton>
```

## Packing

Some containers like `GtkHeaderBar` have start and end packing areas. Use `Pack.Start` and `Pack.End`:

```tsx
import { GtkHeaderBar, GtkButton, Pack } from '@gtkx/react';

<GtkHeaderBar>
    <Pack.Start>
        <GtkButton iconName="go-previous-symbolic" />
        <GtkButton iconName="go-next-symbolic" />
    </Pack.Start>
    <Pack.End>
        <GtkMenuButton iconName="open-menu-symbolic" />
    </Pack.End>
</GtkHeaderBar>
```

Pack components:
- `Pack.Start` - Pack children at the start (left in LTR)
- `Pack.End` - Pack children at the end (right in LTR)

## Toolbar Slots

`GtkToolbarView` uses `Toolbar.Top` and `Toolbar.Bottom` for toolbar areas:

```tsx
import { GtkToolbarView, GtkHeaderBar, GtkBox, Toolbar } from '@gtkx/react';

<GtkToolbarView>
    <Toolbar.Top>
        <GtkHeaderBar />
    </Toolbar.Top>
    <GtkBox>
        Main content area
    </GtkBox>
    <Toolbar.Bottom>
        <GtkActionBar>
            <GtkButton label="Cancel" />
            <GtkButton label="Apply" />
        </GtkActionBar>
    </Toolbar.Bottom>
</GtkToolbarView>
```

## Overlay Slots

`GtkOverlay` places widgets on top of a main child:

```tsx
import { GtkOverlay, GtkPicture, GtkLabel, Overlay } from '@gtkx/react';

<GtkOverlay>
    <GtkPicture filename="/path/to/image.jpg" />
    <Overlay>
        <GtkLabel
            label="Caption"
            halign={Gtk.Align.END}
            valign={Gtk.Align.END}
            margin={12}
        />
    </Overlay>
</GtkOverlay>
```

The first child becomes the main widget. `Overlay` children are stacked on top.

## Dynamic Slot Content

Slots work with conditional rendering:

```tsx
const [loading, setLoading] = useState(true);

<GtkExpander label="Data">
    <Slot id="child">
        {loading ? (
            <GtkSpinner spinning={true} />
        ) : (
            <GtkLabel label={data} />
        )}
    </Slot>
</GtkExpander>
```

When the condition changes, GTKX automatically updates the slot by calling the property setter with the new child.

## Slot vs Direct Children

Use slots when:
- The widget has a named property for the child (like `titlebar`, `labelWidget`)
- You need to place content in a specific area (like overlays)
- The GTK documentation mentions a property that accepts a widget

Use direct children when:
- The widget uses `append()` for children (most containers)
- Children are part of a list or sequence
- No specific property is needed

```tsx
// Direct children - uses append()
<GtkBox>
    <GtkLabel label="First" />
    <GtkLabel label="Second" />
</GtkBox>

// Slot - sets a specific property
<GtkWindow>
    <Slot id="titlebar">
        <GtkHeaderBar />
    </Slot>
</GtkWindow>
```

## Available Slots

Common widgets with slot properties:

| Widget | Slots |
|--------|-------|
| `GtkWindow` | `titlebar`, `child` |
| `GtkHeaderBar` | `titleWidget` |
| `GtkExpander` | `child`, `labelWidget` |
| `GtkFrame` | `child`, `labelWidget` |
| `GtkButton` | `child` |
| `GtkToggleButton` | `child` |
| `GtkScrolledWindow` | `child` |
| `GtkViewport` | `child` |
| `GtkPopover` | `child` |
| `GtkRevealer` | `child` |
| `GtkSearchBar` | `child`, `keyCaptureWidget` |

Adwaita widgets:
| Widget | Slots |
|--------|-------|
| `AdwApplicationWindow` | `content` |
| `AdwHeaderBar` | `titleWidget` |
| `AdwToolbarView` | (uses `Toolbar.Top`, `Toolbar.Bottom`) |
| `AdwNavigationPage` | `child` |
| `AdwPreferencesGroup` | `headerSuffix` |
