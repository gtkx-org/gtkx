---
sidebar_position: 1
slug: /introduction
---

# Introduction

GTKX is a framework for building native GTK4 desktop applications using React and TypeScript. It provides a custom React reconciler that maps React components to native GTK widgets through FFI bindings, enabling declarative UI development with full access to the GTK ecosystem.

## How It Works

GTKX bridges the gap between React's component model and GTK's widget system through several layers:

```
React Components → Reconciler → Node System → FFI Bindings → GTK Widgets
```

1. **React Reconciler**: A custom host config that translates React operations (create, update, delete) into GTK widget manipulations
2. **Node System**: TypeScript classes that wrap GTK widgets and handle their lifecycle, properties, and children
3. **FFI Bindings**: Auto-generated TypeScript bindings that call native GTK functions via libffi
4. **Native Module**: A Rust-based Neon module that handles the actual FFI calls and GLib main loop integration

## Key Concepts

### Widgets and Components

Every GTK widget is available as a JSX component. Components are prefixed with their namespace:

```tsx
import { GtkButton, GtkLabel, GtkBox } from '@gtkx/react';

<GtkBox spacing={6}>
    <GtkLabel label="Hello" />
    <GtkButton label="Click me" onClicked={() => console.log('clicked')} />
</GtkBox>
```

Props map directly to GObject properties. Signal handlers use the `on` prefix followed by the signal name in camelCase.

### Node Categories

GTKX uses different node types to handle GTK's varying widget behaviors:

**Widget Nodes** handle standard GTK widgets with predictable container behavior. Most widgets fall into this category.

**Virtual Nodes** represent logical structures without corresponding GTK containers:
- `ListItem` - Data items in ListView/GridView/ColumnView
- `StackPage` - Pages in Stack/ViewStack
- `GridChild` - Positioned children in Grid
- `Menu.Item`, `Menu.Section`, `Menu.Submenu` - Menu structure
- `Slot` - Widget properties that accept children

**Container Nodes** manage children with special logic:
- `ListView`, `GridView`, `ColumnView` - Data-driven lists with virtualization
- `Grid` - Positioned layout
- `Notebook` - Tabbed interface
- `PopoverMenu` - Menu structure

**Specialized Nodes** handle widgets with unique behavior:
- `Window` - Application windows with transient relationships
- `StackPage` - Dynamic page registration

### Properties and Signals

Widget properties are set via props:

```tsx
<GtkButton label="Click" sensitive={isEnabled} />
```

Signal handlers use the `on` prefix:

```tsx
<GtkEntry onChanged={() => console.log('text changed')} />
```

The reconciler automatically detects whether a prop is a property (calls setter) or signal (connects handler) based on the widget's introspection data.

### Children and Containers

GTK widgets use various methods to manage children. GTKX detects the appropriate method automatically:

- `append()` / `remove()` - Most containers
- `setChild()` - Single-child containers
- `insert()` / `insertBefore()` - Ordered insertion

Some widgets accept children in special properties rather than as direct children. Use the `Slot` component for these:

```tsx
<GtkWindow>
    <Slot id="titlebar">
        <GtkHeaderBar />
    </Slot>
    <GtkBox>Main content</GtkBox>
</GtkWindow>
```

## Differences from React DOM

### No DOM, No CSS Selectors

GTK uses its own styling system. Classes are applied via the `cssClasses` prop:

```tsx
import { css } from '@gtkx/css';

const buttonStyle = css`
    padding: 12px;
    background: @theme_accent_color;
`;

<GtkButton cssClasses={[buttonStyle]} />
```

GTK CSS supports a subset of web CSS properties plus theme variables like `@theme_bg_color`.

### Synchronous Rendering

Unlike React DOM which batches updates and renders asynchronously, GTKX commits changes synchronously to maintain GTK's expectations around widget state.

### Async Operations

For async operations like file dialogs, use the GTK API directly:

```tsx
const dialog = new Gtk.FileDialog();
const file = await dialog.open(window);
```

### Single-Threaded

GTK is single-threaded. All UI operations must happen on the main thread. GTKX handles this automatically, but be aware that blocking the main thread blocks the UI.

## Package Structure

GTKX is organized into several packages:

| Package | Description |
|---------|-------------|
| `@gtkx/react` | React reconciler and JSX components |
| `@gtkx/ffi` | Auto-generated FFI bindings for GTK4/GLib/Adwaita |
| `@gtkx/css` | CSS-in-JS styling with GTK theme integration |
| `@gtkx/testing` | Testing utilities with Testing Library-style API |
| `@gtkx/cli` | CLI with Vite-based dev server and HMR |
| `@gtkx/native` | Rust module for FFI calls via libffi |

## Type Safety

All components are fully typed. Props include documentation from GObject introspection:

```tsx
<GtkButton
    label="Click"           // string
    sensitive={true}        // boolean
    onClicked={() => {}}    // () => void
/>
```

Generic components like `ListView` preserve your data types:

```tsx
interface User {
    id: string;
    name: string;
}

<ListView<User>
    renderItem={(user) => <GtkLabel label={user?.name ?? ""} />}
>
    {users.map(u => <ListItem key={u.id} id={u.id} value={u} />)}
</ListView>
```

## Next Steps

- [Getting Started](./getting-started) - Create your first app
- [CLI](./cli) - Dev server, HMR, and project creation
- [Styling](./styling) - CSS-in-JS with GTK theme variables
- [Testing](./testing) - Testing Library-style API
