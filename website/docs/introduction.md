---
sidebar_position: 1
slug: /
---

# Introduction

GTKX is a framework for building GTK4 desktop applications using React and TypeScript. It bridges the GTK4 C library with React's component model through FFI (Foreign Function Interface), enabling developers to write native Linux desktop applications using familiar React patterns.

## Why GTKX?

- **React Patterns**: Use hooks, state management, and component composition you already know
- **Type Safety**: Full TypeScript support with auto-generated types from GTK's GObject Introspection
- **Native Performance**: Direct FFI calls to GTK4 - no Electron, no WebView
- **Modern GTK4**: Access the latest GTK4 widgets and features

## Quick Example

```tsx
import { ApplicationWindow, Box, Button, Label, quit, render } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <Box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} spacing={12}>
      <Label.Root label={`Count: ${count}`} cssClasses={["title-2"]} />
      <Button label="Increment" onClicked={() => setCount(c => c + 1)} />
    </Box>
  );
};

// Export app instance for use in dialogs
export const app = render(
  <ApplicationWindow title="Hello, GTKX!" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
    <Counter />
  </ApplicationWindow>,
  "com.example.app"
);
```

## Package Structure

GTKX is organized as a monorepo with the following packages:

| Package | Description |
|---------|-------------|
| `@gtkx/react` | React integration layer with JSX components |
| `@gtkx/ffi` | Generated TypeScript FFI bindings for GTK libraries |
| `@gtkx/gir` | GIR file parser for code generation |
| `@gtkx/native` | Rust-based Neon module for FFI calls |
| `@gtkx/css` | Emotion-style CSS-in-JS for styling GTK widgets |

## How It Works

1. **GIR Parsing**: GTK's GObject Introspection files describe the C API
2. **Code Generation**: TypeScript bindings are generated from GIR files
3. **React Reconciler**: A custom reconciler translates React elements to GTK widgets
4. **FFI Bridge**: Rust + libffi enables dynamic calls to GTK's C functions

## Requirements

- Node.js 20+
- GTK4 runtime libraries
- Linux (GTK4 is primarily a Linux toolkit)

For development from source, you also need:
- pnpm 10+
- Rust toolchain
- GTK4 development headers

## Next Steps

- [Getting Started](/docs/getting-started) - Install and create your first app
- [Components Guide](/docs/guides/components) - Core API and component patterns
- [Styling Guide](/docs/guides/styling) - CSS-in-JS styling with @gtkx/css
- [Dialogs Guide](/docs/guides/dialogs) - Working with file, color, and alert dialogs
- [Architecture](/docs/architecture) - Deep dive into how GTKX works
