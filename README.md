<p align="center">
  <img src="https://raw.githubusercontent.com/eugeniodepalo/gtkx/HEAD/logo.svg" alt="GTKX Logo" width="128" height="128">
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
- **Hot Module Replacement** — Edit your code and see changes instantly, powered by Vite
- **Native Performance** — Direct FFI bindings to GTK4 via Rust and libffi
- **CLI & Scaffolding** — Get started in seconds with `npx @gtkx/cli create`
- **CSS-in-JS Styling** — Emotion-style `css` template literals for GTK widgets
- **Testing Library** — Familiar `screen`, `userEvent`, and query APIs for testing components

## Quick Start

Create a new GTKX app with a single command:

```bash
npx @gtkx/cli create
```

This launches an interactive wizard that sets up your project with TypeScript, your preferred package manager, and optional testing support.

You can also pass options directly:

```bash
npx @gtkx/cli create my-app --app-id com.example.myapp --pm pnpm --testing vitest
```

Then start developing with HMR:

```bash
cd my-app
npm run dev
```

Edit your code and see changes instantly without restarting the app!

### Manual Setup

Alternatively, install packages directly:

```bash
npm install @gtkx/cli @gtkx/react @gtkx/ffi react
npm install -D @types/react typescript
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
      <Box orientation={Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
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

Run with HMR:

```bash
npx gtkx dev src/app.tsx
```

Or without HMR:

```bash
npx tsx index.tsx
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
import { cleanup, render, screen, userEvent, fireEvent } from "@gtkx/testing";
import { AccessibleRole } from "@gtkx/ffi/gtk";
import { App } from "./app.js";

// Clean up after each test
afterEach(async () => {
  await cleanup();
});

test("increments count when clicking button", async () => {
  await render(<App />);

  const button = await screen.findByRole(AccessibleRole.BUTTON, {
    name: "Increment",
  });
  await userEvent.click(button);

  await screen.findByText("Count: 1");
});

test("can also use fireEvent for low-level signals", async () => {
  await render(<App />);

  const button = await screen.findByRole(AccessibleRole.BUTTON, {
    name: "Increment",
  });
  fireEvent(button, "clicked");

  await screen.findByText("Count: 1");
});
```

### Available APIs

**Queries** - Find elements in the rendered tree (all async):
- `findBy*` / `findAllBy*` - Waits for element to appear

Query types: `ByRole`, `ByText`, `ByLabelText`, `ByTestId`

**User Interactions**:
- `userEvent.click(element)` - Simulate click
- `userEvent.dblClick(element)` - Simulate double click
- `userEvent.activate(element)` - Activate element (e.g., press Enter in input)
- `userEvent.type(element, text)` - Type text into input
- `userEvent.clear(element)` - Clear input text
- `userEvent.tab(element, options?)` - Simulate Tab navigation
- `userEvent.selectOptions(element, values)` - Select options in ComboBox/ListBox
- `userEvent.deselectOptions(element, values)` - Deselect options in ListBox

**Low-level Events**:
- `fireEvent(element, signalName, ...args)` - Emit any GTK signal with optional arguments

**Utilities**:
- `waitFor(callback)` - Wait for condition
- `waitForElementToBeRemoved(element)` - Wait for element removal

## Examples

### GTK4 Demo

A comprehensive showcase of GTK4 widgets and features:

```bash
cd examples/gtk4-demo
pnpm dev
```

### Todo App

A todo app demonstrating `@gtkx/testing` with realistic component tests:

```bash
cd examples/todo
pnpm dev
pnpm test
```

## Packages

| Package | Description |
|---------|-------------|
| [@gtkx/cli](packages/cli) | CLI for creating and developing GTKX apps with HMR |
| [@gtkx/react](packages/react) | React reconciler and JSX components |
| [@gtkx/ffi](packages/ffi) | TypeScript FFI bindings for GTK4 |
| [@gtkx/native](packages/native) | Rust native module for FFI bridge |
| [@gtkx/css](packages/css) | CSS-in-JS styling for GTK widgets |
| [@gtkx/testing](packages/testing) | Testing utilities for GTKX components |
| [@gtkx/gir](packages/gir) | GObject Introspection parser for codegen |

## Requirements

- Node.js 20+
- GTK4
- Linux (GTK4 is Linux-native)

## License

[MPL-2.0](LICENSE)
