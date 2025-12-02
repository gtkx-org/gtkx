---
sidebar_position: 2
---

# Getting Started

This guide will help you set up GTKX and create your first GTK4 application with React.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** — GTKX uses modern JavaScript features
- **pnpm, npm, or yarn** — For package management
- **GTK4 development libraries** — Required for native bindings
- **Linux** — GTK4 is designed for Linux (GNOME desktop)

### Installing GTK4

On Fedora:

```bash
sudo dnf install gtk4-devel
```

On Ubuntu/Debian:

```bash
sudo apt install libgtk-4-dev
```

On Arch Linux:

```bash
sudo pacman -S gtk4
```

## Installation

Create a new project and install GTKX:

```bash
mkdir my-gtk-app
cd my-gtk-app
pnpm init
pnpm add @gtkx/react react
```

For styling support:

```bash
pnpm add @gtkx/css
```

For testing support:

```bash
pnpm add -D @gtkx/testing vitest
```

## Project Setup

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Update your `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "start": "tsx src/index.tsx"
  }
}
```

## Your First App

Create the following files in a `src` directory:

### `src/index.tsx`

```tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

render(<App />, "org.example.MyApp");
```

The `render` function initializes GTK and mounts your React tree. The second argument is your application ID (reverse domain notation).

### `src/app.tsx`

```tsx
import { ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";
import { useState } from "react";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <ApplicationWindow
      title="My First GTKX App"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <Box
        orientation={Orientation.VERTICAL}
        spacing={12}
        marginTop={20}
        marginBottom={20}
        marginStart={20}
        marginEnd={20}
      >
        <Label.Root label={`You clicked ${count} times`} />
        <Box orientation={Orientation.HORIZONTAL} spacing={8}>
          <Button
            label="Decrement"
            onClicked={() => setCount(c => c - 1)}
          />
          <Button
            label="Increment"
            onClicked={() => setCount(c => c + 1)}
          />
        </Box>
      </Box>
    </ApplicationWindow>
  );
};
```

## Running Your App

Start your application:

```bash
pnpm start
```

You should see a native GTK4 window with your counter application!

## Understanding the Code

### `render(element, appId)`

The entry point for GTKX applications. It:
1. Initializes the GTK main loop
2. Creates a GTK Application with the given ID
3. Mounts your React element tree
4. Starts the event loop

### `ApplicationWindow`

The main window component. Key props:
- `title` — Window title
- `defaultWidth` / `defaultHeight` — Initial window size
- `onCloseRequest` — Called when the window close button is clicked

### `quit()`

Cleanly shuts down the application by:
1. Unmounting the React tree
2. Stopping the GTK main loop

Always use `quit()` in `onCloseRequest` to ensure proper cleanup.

### Layout with `Box`

`Box` is the primary layout container in GTK. Use `orientation` to set horizontal or vertical layout, and `spacing` to add gaps between children.

### Handling Events

GTK signals are exposed as React props with the `on` prefix:
- `onClicked` — Button clicks
- `onCloseRequest` — Window close
- `onChanged` — Text input changes

## Next Steps

- [Styling Guide](./guides/styling) — Add custom styles with CSS-in-JS
- [Testing Guide](./guides/testing) — Write tests for your components
