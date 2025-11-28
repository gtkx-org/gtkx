---
sidebar_position: 2
---

# Getting Started

This guide will help you set up GTKX and create your first GTK4 application with React.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or later
- **GTK4** runtime libraries (usually pre-installed on modern Linux desktops)

### Installing GTK4 on Linux

GTK4 is typically pre-installed on GNOME-based distributions. If not, install the runtime:

**Fedora:**
```bash
sudo dnf install gtk4
```

**Ubuntu/Debian:**
```bash
sudo apt install libgtk-4-1
```

**Arch Linux:**
```bash
sudo pacman -S gtk4
```

## Installation

Install the GTKX packages from npm:

```bash
npm install @gtkx/react @gtkx/ffi react
```

Or with pnpm:

```bash
pnpm add @gtkx/react @gtkx/ffi react
```

## Creating Your First App

### Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-gtkx-app
cd my-gtkx-app
npm init -y
npm install @gtkx/react @gtkx/ffi react typescript @types/react
```

### Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Update your `package.json`:

```json
{
  "name": "my-gtkx-app",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Your First Component

Create `src/index.tsx`:

```tsx
import { ApplicationWindow, Button, Box, Label, quit, render } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <ApplicationWindow
      title="My First GTKX App"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <Box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={10}
        marginTop={20}
        marginStart={20}
        marginEnd={20}
        valign={Gtk.Align.CENTER}
      >
        <Label.Root label={`Count: ${count}`} cssClasses={["title-2"]} />
        <Button
          label="Increment"
          cssClasses={["suggested-action"]}
          onClicked={() => setCount(c => c + 1)}
        />
        <Button
          label="Reset"
          onClicked={() => setCount(0)}
        />
      </Box>
    </ApplicationWindow>
  );
};

// Export the app instance for use in components that need it (e.g., dialogs)
export const app = render(<App />, "com.example.myapp");
```

### Run Your App

```bash
npm run build
npm start
```

## Project Structure

A typical GTKX project looks like:

```
my-gtkx-app/
├── src/
│   └── index.tsx      # Entry point (exports app instance)
├── dist/              # Compiled output
├── package.json
└── tsconfig.json
```

## Key Concepts

### The App Instance

Export your app instance from the entry point:

```tsx
export const app = render(<App />, "com.example.myapp");
```

This allows components to access the application object for things like:
- Getting the active window: `app.getActiveWindow()`
- Showing dialogs with proper parent windows

### GTK Enums

Import GTK enums from `@gtkx/ffi/gtk`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<Box orientation={Gtk.Orientation.VERTICAL} />
<Label.Root halign={Gtk.Align.START} />
```

### CSS Classes

Use GTK's built-in style classes and custom CSS:

```tsx
// Built-in classes
<Button cssClasses={["suggested-action"]} label="Primary" />
<Button cssClasses={["destructive-action"]} label="Delete" />
<Label.Root cssClasses={["title-2", "dim-label"]} label="Title" />

// Custom CSS with @gtkx/css
import { css } from "@gtkx/css";

const myStyle = css`
  padding: 16px;
  border-radius: 8px;
`;

<Button cssClasses={[myStyle]} label="Styled" />
```

## Building from Source

If you want to contribute or need the latest development version, you'll need additional build dependencies:

- **Rust toolchain** - For compiling the native FFI module
- **GTK4 development headers** - For GObject introspection

**Fedora:**
```bash
sudo dnf install gtk4-devel gobject-introspection-devel
```

**Ubuntu/Debian:**
```bash
sudo apt install libgtk-4-dev gobject-introspection
```

Then clone and build:

```bash
git clone https://github.com/eugeniodepalo/gtkx.git
cd gtkx
pnpm install
pnpm build

# Run the demo
cd examples/gtk4-demo && turbo start
```

## Next Steps

- [Components Guide](/docs/guides/components) - Learn about available widgets
- [Styling Guide](/docs/guides/styling) - CSS-in-JS styling with @gtkx/css
- [Event Handling](/docs/guides/events) - Handle user interactions
- [Dialogs Guide](/docs/guides/dialogs) - Work with file, color, and alert dialogs
- [Architecture](/docs/architecture) - Understand how GTKX works internally
