---
sidebar_position: 2
---

# Getting Started

This guide will help you set up GTKX and create your first GTK4 application with React.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or later
- **GTK4** development libraries

### Installing GTK4 on Linux

**Fedora:**
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

## Installation

Install the GTKX packages from npm:

```bash
npm install @gtkx/gtkx react
```

Or with pnpm:

```bash
pnpm add @gtkx/gtkx react
```

## Creating Your First App

### Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-gtkx-app
cd my-gtkx-app
npm init -y
npm install @gtkx/gtkx react typescript @types/react
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
import { ApplicationWindow, Button, Box, Label, quit, render } from "@gtkx/gtkx";
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
      <Box spacing={10} marginTop={20} marginStart={20} marginEnd={20}>
        <Label.Root label={`Count: ${count}`} />
        <Button
          label="Increment"
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

render(<App />, "com.example.myapp");
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
│   └── index.tsx      # Entry point
├── dist/              # Compiled output
├── package.json
└── tsconfig.json
```

## Building from Source

If you want to contribute or need the latest development version:

```bash
# Clone the repository
git clone https://github.com/eugeniodepalo/gtkx.git
cd gtkx

# Install dependencies
pnpm install

# Install additional build dependencies
# Fedora: sudo dnf install gobject-introspection-devel
# Ubuntu: sudo apt install gobject-introspection
# You also need Rust toolchain for the native module

# Sync GIR files and build
cd packages/ffi && pnpm run codegen --sync
cd ../.. && pnpm build

# Run the examples
cd examples/demo && pnpm build && pnpm start
```

## Next Steps

- [Components Guide](/docs/guides/components) - Learn about available widgets
- [Event Handling](/docs/guides/events) - Handle user interactions
- [Architecture](/docs/architecture) - Understand how GTKX works internally
