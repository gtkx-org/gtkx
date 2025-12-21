---
sidebar_position: 2
---

# Getting Started

Get up and running with GTKX in under a minute.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** — GTKX uses modern JavaScript features
- **GTK4** — Install `gtk4` via your distribution's package manager
- **Linux** — GTK4 is designed for Linux (GNOME desktop)
- **libadwaita** (optional) — For modern GNOME-style applications

## Create Your App

The fastest way to start is with the GTKX CLI:

```bash
npx @gtkx/cli@latest create
```

This launches an interactive wizard that will:

1. Ask for your project name
2. Ask for your app ID (e.g., `com.example.myapp`)
3. Let you choose your package manager (pnpm, npm, yarn, or bun)
4. Create the project and install dependencies

You can also pass options directly:

```bash
npx @gtkx/cli@latest create my-app --app-id com.example.myapp --pm pnpm
```

## Start Development

Navigate to your project and start the dev server:

```bash
cd my-app
npm run dev
```

This starts the GTKX development server with **HMR** (Hot Module Replacement) — edit your code and see changes instantly without restarting the app!

## Project Structure

The CLI creates a ready-to-go project:

```
my-app/
├── package.json
├── tsconfig.json
├── .gitignore
└── src/
    ├── app.tsx      # Your main component
    └── index.tsx    # Entry point
```

### `src/app.tsx`

```tsx
import { useState } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, quit } from "@gtkx/react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <GtkApplicationWindow
      title="My App"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={20}
        marginTop={40}
        marginStart={40}
        marginEnd={40}
      >
        Welcome to GTKX!
        {`Count: ${count}`}
        <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
      </GtkBox>
    </GtkApplicationWindow>
  );
}

export const appId = "com.example.myapp";
```

### `src/index.tsx`

```tsx
import { render } from "@gtkx/react";
import App, { appId } from "./app.js";

render(<App />, appId);
```

## Understanding the Code

### `render(element, appId)`

The entry point for GTKX applications. It:

1. Initializes the GTK main loop
2. Creates a GTK Application with the given ID
3. Mounts your React element tree
4. Starts the event loop

### `GtkApplicationWindow`

The main window component. Key props:

- `title` — Window title
- `defaultWidth` / `defaultHeight` — Initial window size
- `onCloseRequest` — Called when the window close button is clicked

### `quit()`

Cleanly shuts down the application by:

1. Unmounting the React tree
2. Stopping the GTK main loop

Always use `quit()` in `onCloseRequest` to ensure proper cleanup.

### Layout with `GtkBox`

`GtkBox` is the primary layout container in GTK. Use `orientation` to set horizontal or vertical layout, and `spacing` to add gaps between children.

### Handling Events

GTK signals are exposed as React props with the `on` prefix:

- `onClicked` — Button clicks
- `onCloseRequest` — Window close
- `onChanged` — Text input changes

## Building for Production

Build your app for production:

```bash
npm run build
npm start
```

This compiles TypeScript and runs the built application without HMR.

## Next Steps

- [Adwaita](./adwaita) — Build modern GNOME apps with libadwaita
- [CLI](./cli) — Learn more about the gtkx CLI
- [Styling](./styling) — Add custom styles with CSS-in-JS
- [Testing](./testing) — Write tests for your components
