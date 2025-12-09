---
sidebar_position: 1
slug: /introduction
---

# Introduction

GTKX is a framework for building native GTK4 desktop applications using React and TypeScript. It bridges React's component model with GTK4's native widget system, allowing you to write familiar React code that renders as native Linux desktop applications.

## Why GTKX?

Building native desktop applications traditionally requires learning platform-specific toolkits and languages. GTKX changes this by letting you use the React skills you already have:

- **Familiar React Patterns** — Use hooks, state, props, and components just like you would in a web app
- **Hot Module Replacement** — Edit your code and see changes instantly, powered by Vite
- **Native Performance** — Direct FFI bindings to GTK4 via Rust and libffi, no Electron overhead
- **CLI & Scaffolding** — Get started in seconds with `npx @gtkx/cli create`

## How It Works

GTKX uses a custom React Reconciler to translate React's virtual DOM operations into GTK4 widget operations:

```
React JSX → React Reconciler → FFI Bindings → GTK4 Widgets
```

1. You write React components using JSX
2. The GTKX reconciler converts React elements into GTK widget nodes
3. TypeScript FFI bindings marshal calls to native GTK4 via Rust
4. GTK4 renders native widgets on your Linux desktop

## Packages

GTKX is organized as a monorepo with the following packages:

| Package | Description |
|---------|-------------|
| `@gtkx/cli` | CLI for creating and developing GTKX apps with HMR |
| `@gtkx/react` | React reconciler and JSX components |
| `@gtkx/ffi` | TypeScript FFI bindings for GTK4, GLib, GIO, Gdk, and more |
| `@gtkx/css` | CSS-in-JS styling for GTK widgets (Emotion-style API) |
| `@gtkx/testing` | Testing utilities with a Testing Library-style API |
| `@gtkx/native` | Rust native module providing the FFI bridge |
| `@gtkx/gir` | GObject Introspection parser for code generation |

## Example

Here's a simple counter application:

```tsx
import { render, ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";
import { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <Box orientation={Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
      <Label.Root label={`Count: ${count}`} />
      <Button label="Increment" onClicked={() => setCount(c => c + 1)} />
    </Box>
  );
};

const App = () => (
  <ApplicationWindow title="Counter" defaultWidth={300} defaultHeight={150} onCloseRequest={quit}>
    <Counter />
  </ApplicationWindow>
);

render(<App />, "org.example.Counter");
```

## Next Steps

- [Getting Started](./getting-started) — Create your first app with the CLI
- [CLI Guide](./guides/cli) — Learn about dev server, HMR, and project scaffolding
- [Styling Guide](./guides/styling) — Style your app with CSS-in-JS
- [Testing Guide](./guides/testing) — Write tests for your components
