---
sidebar_position: 4
---

# Architecture

This document explains the internal architecture of GTKX and how it bridges React with GTK4.

## Overview

GTKX consists of five packages that work together to render React components as native GTK widgets:

```
┌─────────────────────────────────────┐
│         Your Application            │
│    (React components + hooks)       │
├─────────────────────────────────────┤
│            @gtkx/react               │
│    React Reconciler + JSX Types     │
├──────────────────┬──────────────────┤
│    @gtkx/ffi     │    @gtkx/css     │
│  GTK Bindings    │   CSS-in-JS      │
├──────────────────┴──────────────────┤
│           @gtkx/native              │
│      Rust FFI Bridge (libffi)       │
├─────────────────────────────────────┤
│         GTK4 / GLib / GIO           │
└─────────────────────────────────────┘
```

## Code Generation

GTKX generates TypeScript bindings from GTK's GObject Introspection (GIR) files. This happens at build time, not runtime.

### GIR Files

GIR files are XML documents that describe GTK's C API. They're located at `/usr/share/gir-1.0/` on Linux systems and contain metadata about classes, methods, properties, and signals:

```xml
<class name="Button" parent="Widget">
  <constructor name="new" c:identifier="gtk_button_new"/>
  <method name="set_label" c:identifier="gtk_button_set_label">
    <parameters>
      <parameter name="label" transfer-ownership="none">
        <type name="utf8"/>
      </parameter>
    </parameters>
  </method>
  <property name="label" writable="1">
    <type name="utf8"/>
  </property>
  <signal name="clicked"/>
</class>
```

### @gtkx/gir

Parses GIR XML files into TypeScript data structures:

```typescript
interface GirClass {
  name: string;
  parent?: string;
  methods: GirMethod[];
  constructors: GirConstructor[];
  properties: GirProperty[];
  signals: GirSignal[];
}

interface GirMethod {
  name: string;
  cIdentifier: string;
  returnType: GirType;
  parameters: GirParameter[];
}
```

### @gtkx/ffi

Generates TypeScript classes that call native GTK functions. Each method uses the `call()` function from `@gtkx/native`:

```typescript
export class Button extends Widget {
  protected override createPtr(): unknown {
    return call("libgtk-4.so.1", "gtk_button_new", [], {
      type: "gobject",
      borrowed: true,
    });
  }

  setLabel(label: string): void {
    call(
      "libgtk-4.so.1",
      "gtk_button_set_label",
      [
        { type: { type: "gobject" }, value: this.ptr },
        { type: { type: "string" }, value: label },
      ],
      { type: "undefined" }
    );
  }

  getLabel(): string {
    return call(
      "libgtk-4.so.1",
      "gtk_button_get_label",
      [{ type: { type: "gobject" }, value: this.ptr }],
      { type: "string" }
    ) as string;
  }
}
```

### @gtkx/react (JSX Generator)

Generates JSX type definitions that map React props to GTK properties and signals:

```typescript
export interface ButtonProps {
  label?: string;
  onClicked?: () => void;
  cssClasses?: string[];
  // ... inherited Widget props
}
```

## React Reconciler

The reconciler translates React operations into GTK widget operations. It implements React's `react-reconciler` API.

### Entry Point

```typescript
// render.ts
export const render = (element: ReactNode, appId: string): void => {
  const app = start(appId);  // Start GTK application
  setCurrentApp(app);
  container = reconciler.createContainer(/* ... */);
  reconciler.updateContainer(element, container, null, () => {});
};
```

### Node System

Different GTK widgets require different handling. GTKX uses a node system where each node type knows how to manage its widget:

| Node | Purpose |
|------|---------|
| `WidgetNode` | Standard widgets (Button, Box, Entry, Window, dialogs) - default fallback |
| `SlotNode` | Named child slots (HeaderBar.TitleWidget, CenterBox.Start, Frame.LabelWidget) |
| `GridNode` | Grid layout container |
| `GridChildNode` | Grid children with row/column positioning (virtual) |
| `ListViewNode` | Virtualized lists (ListView, ColumnView, GridView) with item factory |
| `ListItemNode` | List items for ListView (virtual) |
| `DropDownNode` | Dropdown with StringList model and selection handling |
| `DropDownItemNode` | Dropdown items (virtual) |
| `OverlayNode` | Overlay widget with main child + overlay children |

**Virtual Nodes**: Some nodes (GridChildNode, ListItemNode, DropDownItemNode) are "virtual" - they don't create GTK widgets but manage how their children are attached to parent widgets. This pattern allows React-style composition while respecting GTK's API.

All nodes extend the abstract `Node` class:

```typescript
interface Node {
  getWidget?(): Gtk.Widget;
  appendChild(child: Node): void;
  removeChild(child: Node): void;
  insertBefore(child: Node, before: Node): void;
  updateProps(oldProps: Props, newProps: Props): void;
  mount(): void;
  dispose?(): void;
}
```

### Factory

The factory creates the appropriate node type for each React element. Node classes are checked in order, and the first matching class is used:

```typescript
const NODE_CLASSES = [
  SlotNode,         // Matches *.TitleWidget, *.Start, *.LabelWidget, etc.
  ListItemNode,     // Matches ListView.Item, ColumnView.Item, GridView.Item
  DropDownItemNode, // Matches DropDown.Item
  DropDownNode,     // Matches DropDown.Root
  GridChildNode,    // Matches Grid.Child
  GridNode,         // Matches Grid.Root
  OverlayNode,      // Matches Overlay.Root
  ListViewNode,     // Matches ListView.Root, ColumnView.Root, GridView.Root
  WidgetNode,       // Fallback for all other widgets
];
```

Each node class has a static `matches(type: string)` method that determines if it should handle a given element type.

## Native Module (@gtkx/native)

Written in Rust using Neon, this module provides the FFI bridge to GTK.

### call()

Dynamically invokes C functions using libffi:

```typescript
call(
  library: string,      // "libgtk-4.so.1"
  symbol: string,       // "gtk_button_set_label"
  args: Arg[],          // [{ type: {...}, value: ... }, ...]
  returnType: Type      // { type: "string" }
): unknown
```

Each argument is an object with `type` and `value`:

```typescript
type Type =
  | { type: "string" }
  | { type: "boolean" }
  | { type: "int"; size: number; unsigned: boolean }
  | { type: "float"; size: number }
  | { type: "gobject"; borrowed?: boolean }
  | { type: "callback"; argTypes: Type[] }
  | { type: "ref"; innerType: Type }
  | { type: "array"; itemType: Type }
  | { type: "undefined" };
```

### start() / stop()

Manage the GTK application lifecycle:

```typescript
start(appId: string, flags?: ApplicationFlags): unknown  // Returns app pointer
stop(): void  // Quits the GTK main loop
```

### createRef()

Creates mutable references for out parameters:

```typescript
const ref = createRef();
someFunctionWithOutParam(ref);
console.log(ref.value);  // Read the output
```

## Compound Components

GTK widgets with named child slots use a compound component pattern:

```tsx
<HeaderBar.Root>
  <HeaderBar.TitleWidget>
    <Label.Root label="App Title" />
  </HeaderBar.TitleWidget>
  <HeaderBar.Start>
    <Button label="Back" />
  </HeaderBar.Start>
  <HeaderBar.End>
    <MenuButton />
  </HeaderBar.End>
</HeaderBar.Root>
```

The `SlotNode` captures these children and assigns them to the correct GTK setter method (e.g., `setTitleWidget()`, `packStart()`).

## Property and Signal Conventions

### Properties

GTK uses snake_case; GTKX converts to camelCase:

| GTK | React |
|-----|-------|
| `default_width` | `defaultWidth` |
| `margin_start` | `marginStart` |
| `css_classes` | `cssClasses` |

### Signals

GTK signals become `on`-prefixed handlers:

| GTK | React |
|-----|-------|
| `clicked` | `onClicked` |
| `close-request` | `onCloseRequest` |
| `state-set` | `onStateSet` |

## Memory Management

- **Widget Pointers**: Stored in the `ptr` property of each FFI class instance
- **Reference Counting**: GTK manages native memory through GObject reference counting
- **Instance Tracking**: The reconciler tracks all nodes in a Set for cleanup
- **Signal Cleanup**: `dispose()` disconnects signal handlers when components unmount
- **Application Exit**: `disposeAllInstances()` ensures all handlers are disconnected before quit
- **Async Calls**: Void-returning FFI calls are dispatched via `g_idle_add_once` to avoid blocking

## GTK Event Loop Integration

### Keep-Alive Mechanism

When you start a GTKX app, Node.js would normally exit because there's nothing keeping the event loop busy. GTKX uses a long-running timeout to prevent this:

```typescript
// Internal implementation - keeps Node.js alive during GTK event loop
const keepAlive = () => {
  keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};
```

This timeout is automatically cleared when `stop()` is called or the app quits.

### Lifecycle Events

The `@gtkx/ffi` package exports an `events` EventEmitter for GTK lifecycle hooks:

```typescript
import { events } from "@gtkx/ffi";

// Called after GTK is initialized
events.on("start", () => {
  console.log("GTK application started");
});

// Called before GTK shuts down
events.on("stop", () => {
  console.log("GTK application stopping");
  // Perform cleanup here
});
```

These events are useful for:
- Setting up global resources after GTK initializes
- Cleaning up resources before shutdown
- Logging application lifecycle
