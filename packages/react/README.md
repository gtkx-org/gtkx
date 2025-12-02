<p align="center">
  <img src="logo.svg" alt="GTKX Logo" width="128" height="128">
</p>

<h1 align="center">GTKX</h1>

<p align="center">
  <strong>Build native GTK4 desktop applications with React and TypeScript</strong>
</p>

<p align="center">
  <a href="https://eugeniodepalo.github.io/gtkx">Documentation</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#examples">Examples</a>
</p>

---

GTKX bridges React's component model with GTK4's native widget system. Write familiar React code and render it as native Linux desktop applications with full access to GTK4 widgets, signals, and styling.

## Features

- **React Components** — Use React hooks, state, and component patterns you already know
- **Type-Safe** — Full TypeScript support with auto-generated types from GTK4 introspection data
- **Native Performance** — Direct FFI bindings to GTK4 via Rust and libffi
- **CSS-in-JS Styling** — Emotion-style `css` template literals for GTK widgets
- **Testing Library** — Familiar `screen`, `userEvent`, and query APIs for testing components

## Quick Start

```bash
# Install dependencies
pnpm add @gtkx/react react

# For styling (optional)
pnpm add @gtkx/css

# For testing (optional)
pnpm add -D @gtkx/testing
```

Create your first app:

```tsx
// index.tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

render(<App />, "org.example.MyApp");
```

```tsx
// app.tsx
import { ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";
import { useState } from "react";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <ApplicationWindow
      title="My App"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <Box orientation={Orientation.VERTICAL} spacing={12} margin={20}>
        <Label.Root label={`Count: ${count}`} />
        <Button
          label="Increment"
          onClicked={() => setCount((c) => c + 1)}
        />
      </Box>
    </ApplicationWindow>
  );
};
```

Run with:

```bash
pnpm tsx index.tsx
```

## Styling

Use `@gtkx/css` for CSS-in-JS styling:

```tsx
import { css } from "@gtkx/css";
import { Button } from "@gtkx/react";

const primaryButton = css`
  padding: 16px 32px;
  border-radius: 24px;
  background: linear-gradient(135deg, #3584e4, #9141ac);
  color: white;
  font-weight: bold;
`;

const MyButton = () => (
  <Button label="Click me" cssClasses={[primaryButton]} />
);
```

GTK also provides built-in CSS classes like `suggested-action`, `destructive-action`, `card`, and `heading`.

## Testing

Use `@gtkx/testing` for Testing Library-style component tests:

```tsx
import { cleanup, render, screen, setup, userEvent } from "@gtkx/testing";
import { AccessibleRole } from "@gtkx/ffi/gtk";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app.js";

setup();

describe("Counter", () => {
  afterEach(() => cleanup());

  it("increments count when clicking button", async () => {
    render(<App />);

    const button = await screen.findByRole(AccessibleRole.BUTTON, {
      name: "Increment",
    });
    await userEvent.click(button);

    await screen.findByText("Count: 1");
  });
});
```

## Examples

### Counter

A minimal counter app demonstrating state management:

```bash
turbo start --filter=counter-example
```

### GTK4 Demo

A comprehensive showcase of GTK4 widgets and features:

```bash
turbo start --filter=gtk4-demo
```

## Packages

| Package | Description |
|---------|-------------|
| [@gtkx/react](packages/react) | React reconciler and JSX components |
| [@gtkx/ffi](packages/ffi) | TypeScript FFI bindings for GTK4 |
| [@gtkx/native](packages/native) | Rust native module for FFI bridge |
| [@gtkx/css](packages/css) | CSS-in-JS styling for GTK widgets |
| [@gtkx/testing](packages/testing) | Testing utilities for GTKX components |
| [@gtkx/gir](packages/gir) | GObject Introspection parser for codegen |

## Requirements

- Node.js 20+
- GTK4 development libraries
- Linux (GTK4 is Linux-native)

## License

[MPL-2.0](LICENSE)
