# Getting Started

This guide walks you through creating your first GTKX application.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 22+** — GTKX requires a modern Node.js runtime
- **GTK4 libraries** — The native GTK4 runtime libraries

## Create a New Project

The fastest way to start is with the GTKX CLI:

```bash
npx @gtkx/cli create my-app
```

The CLI will prompt you for:

- **Project name** — lowercase letters, numbers, and hyphens
- **App ID** — reverse domain notation (e.g., `com.example.myapp`)
- **Package manager** — pnpm (recommended), npm, yarn, or bun
- **Testing framework** — vitest (recommended), jest, node test runner, or none

After the prompts, the CLI creates your project and installs dependencies.

## Project Structure

A new GTKX project has this structure:

```
my-app/
├── src/
│   ├── app.tsx       # Main application component
│   ├── dev.tsx       # Development entry point
│   └── index.tsx     # Production entry point
├── tests/
│   └── app.test.tsx  # Example test
├── package.json
└── tsconfig.json
```

### Key Files

**`src/app.tsx`** — Your main React component:

```tsx
import { useState } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import {
  GtkApplicationWindow,
  GtkBox,
  GtkButton,
  GtkLabel,
  quit,
} from "@gtkx/react";

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
        <GtkLabel label={`Count: ${count}`} />
        <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
      </GtkBox>
    </GtkApplicationWindow>
  );
}
```

**`src/index.tsx`** — Production entry point:

```tsx
import { render } from "@gtkx/react";
import pkg from "../package.json" with { type: "json" };
import App from "./app.js";

render(<App />, pkg.gtkx.appId);
```

**`package.json`** — Contains your app ID in the `gtkx` config:

```json
{
  "gtkx": {
    "appId": "com.example.myapp"
  }
}
```

## Run the Development Server

Start the development server with hot reload:

```bash
npm run dev
```

This starts your application with Hot Module Replacement (HMR). When you edit your components, changes appear instantly without losing application state.

## Build for Production

Compile your TypeScript and prepare for distribution:

```bash
npm run build
npm start
```

## Run Tests

If you selected a testing framework:

```bash
npm test
```

Tests run in a real GTK environment using `xvfb-run` for headless execution.

## Understanding the Basics

### Components Map to Widgets

GTKX components correspond to GTK widgets. The naming convention:

- GTK widgets: `GtkButton`, `GtkLabel`, `GtkBox`, `GtkEntry`
- Adwaita widgets: `AdwHeaderBar`, `AdwViewStack`, `AdwActionRow`

### Props Set Widget Properties

Component props map to GTK widget properties:

```tsx
<GtkButton
  label="Click me" // Sets the button label
  sensitive={false} // Disables the button
  cssClasses={["suggested-action"]} // Adds CSS classes
/>
```

### Callbacks Handle Signals

GTK signals become React callbacks with an `on` prefix:

```tsx
<GtkButton
    onClicked={() => console.log("clicked")}  // "clicked" signal
/>

<GtkEntry
    onChanged={() => console.log("text changed")}  // "changed" signal
/>
```

### GTK Enums

GTK enums come from the FFI package:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<GtkBox orientation={Gtk.Orientation.VERTICAL} />
<GtkLabel halign={Gtk.Align.CENTER} />
```

## What's Next?

- [CLI Reference](./cli.md) — All CLI commands and options
- [Styling](./styling.md) — CSS-in-JS for GTK
- [Lists](./lists.md) — Building list interfaces
- [Testing](./testing.md) — Testing your components
