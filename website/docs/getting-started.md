---
sidebar_position: 2
---

# Getting Started

Create and run your first GTKX application.

## Prerequisites

GTKX requires:

- **Node.js 20+** with ES modules support
- **GTK4 development libraries** including headers and pkg-config files
- **Linux** with a running display server (X11 or Wayland)

### Installing GTK4

**Fedora/RHEL:**
```bash
sudo dnf install gtk4-devel
```

**Ubuntu/Debian:**
```bash
sudo apt install libgtk-4-dev
```

**Arch Linux:**
```bash
sudo pacman -S gtk4
```

Verify the installation:
```bash
pkg-config --modversion gtk4
```

## Create a Project

Use the CLI to scaffold a new project:

```bash
npx @gtkx/cli@latest create my-app
```

The wizard prompts for:
- **App ID**: Reverse-domain identifier (e.g., `com.example.myapp`)
- **Package Manager**: pnpm, npm, yarn, or bun
- **Testing Framework**: vitest, jest, node test runner, or none

Or pass options directly:

```bash
npx @gtkx/cli@latest create my-app \
    --app-id com.example.myapp \
    --pm pnpm \
    --testing vitest
```

## Project Structure

```
my-app/
├── package.json
├── tsconfig.json
├── tsconfig.app.json
└── src/
    └── app.tsx          # Entry point
```

## Entry Point

The entry module must export a default component function:

```tsx
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, quit } from '@gtkx/react';
import * as Gtk from '@gtkx/ffi/gtk';
import { useState } from 'react';

export default function App() {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow
            title="Counter"
            defaultWidth={400}
            defaultHeight={300}
            onCloseRequest={quit}
        >
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginTop={20}
                marginStart={20}
                marginEnd={20}
            >
                <GtkLabel label={`Count: ${count}`} />
                <GtkButton
                    label="Increment"
                    onClicked={() => setCount(c => c + 1)}
                />
            </GtkBox>
        </GtkApplicationWindow>
    );
}

export const appId = 'com.example.counter';
```

### Required Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `() => ReactNode` | Component function to render |
| `appId` | `string` | Application identifier (optional, defaults to `com.gtkx.app`) |
| `appFlags` | `Gio.ApplicationFlags` | Application flags (optional) |

### Application Flags

Control application behavior with `Gio.ApplicationFlags`:

```tsx
import * as Gio from '@gtkx/ffi/gio';

export const appFlags = Gio.ApplicationFlags.NON_UNIQUE;
```

Common flags:
- `FLAGS_NONE` - Default behavior (single instance)
- `NON_UNIQUE` - Allow multiple instances
- `HANDLES_OPEN` - Handle file arguments

## Run the Dev Server

Start the development server with HMR:

```bash
cd my-app
pnpm dev
```

The dev server:
- Watches for file changes
- Performs component-local HMR when possible
- Falls back to full reload for non-refreshable changes
- Preserves component state during updates

## Core Components

### GtkApplicationWindow

The root window for your application:

```tsx
<GtkApplicationWindow
    title="My App"
    defaultWidth={800}
    defaultHeight={600}
    onCloseRequest={quit}
>
    {children}
</GtkApplicationWindow>
```

Key props:
- `title` - Window title bar text
- `defaultWidth` / `defaultHeight` - Initial dimensions
- `onCloseRequest` - Handler when close button clicked (return `true` to prevent close)

### GtkBox

Primary layout container:

```tsx
<GtkBox
    orientation={Gtk.Orientation.VERTICAL}
    spacing={12}
    homogeneous={false}
>
    <GtkLabel label="First" />
    <GtkLabel label="Second" />
</GtkBox>
```

- `orientation` - `VERTICAL` or `HORIZONTAL`
- `spacing` - Gap between children in pixels
- `homogeneous` - Equal size for all children

### quit()

Cleanly shut down the application:

```tsx
import { quit } from '@gtkx/react';

<GtkApplicationWindow onCloseRequest={quit}>
```

This unmounts the React tree, releases resources, and exits the GTK main loop.

## Signals and Properties

### Setting Properties

Widget properties become props:

```tsx
<GtkLabel
    label="Hello"
    xalign={0}
    wrap={true}
    selectable={true}
/>
```

### Connecting Signals

Signal handlers use the `on` prefix:

```tsx
<GtkButton
    label="Click"
    onClicked={() => console.log('clicked')}
/>

<GtkEntry
    onChanged={() => console.log('text changed')}
    onActivate={() => console.log('enter pressed')}
/>
```

Signal names are converted from kebab-case to camelCase:
- `clicked` → `onClicked`
- `close-request` → `onCloseRequest`
- `notify::label` → `onNotifyLabel`

## Text Content

Strings as children become `GtkLabel` widgets:

```tsx
<GtkBox>
    Hello World
    {`Count: ${count}`}
</GtkBox>
```

Equivalent to:

```tsx
<GtkBox>
    <GtkLabel label="Hello World" />
    <GtkLabel label={`Count: ${count}`} />
</GtkBox>
```

## Build for Production

Compile TypeScript and run without HMR:

```bash
pnpm build
pnpm start
```

For deployment options, see [Deploying](./deploying).

## Next Steps

- [CLI](./cli) - CLI options and Vite configuration
- [Styling](./styling) - CSS-in-JS with GTK theme variables
- [Slots](./slots) - Widget properties that accept children
- [Lists](./lists) - Data-driven list widgets
