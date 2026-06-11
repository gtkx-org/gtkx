# Getting started

This guide walks you through creating your first GTKX application.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 24+** — GTKX requires a modern Node.js runtime
- **GTK4 libraries** — The native GTK4 runtime libraries

## Create a new project

The fastest way to start is with the GTKX CLI:

```bash
npx @gtkx/cli@latest create my-app
```

The CLI will prompt you for:

- **Project name** — lowercase letters, numbers, and hyphens
- **App ID** — reverse domain notation (e.g., `com.example.myapp`)
- **Package manager** — pnpm (recommended), npm, or yarn
- **Testing** — whether to include Vitest testing setup
- **Claude Skills** — optional helper files for AI code generation

After the prompts, the CLI creates your project and installs dependencies.

## Project structure

A new GTKX project has this structure:

```
my-app/
├── src/
│ ├── app.tsx # Main application component
│ └── index.tsx # Entry that mounts the app, used by `gtkx dev` and `gtkx build`
├── tests/
│ └── app.test.tsx # Example test
├── gtkx.config.ts
├── package.json
└── tsconfig.json
```

### Key files

**`src/app.tsx`** — The default app component (just an example, can be removed or renamed). The `App` component wraps the window in a `GtkApplication`, which owns the application and defaults its `applicationId` to the one declared in `gtkx.config.ts`. It is provided as both a named export `App` and the default export:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { quit } from "@gtkx/react";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";

const MainWindow = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow title="My App" defaultWidth={400} defaultHeight={300} onClose={quit}>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={20}
                marginTop={40}
                marginBottom={40}
                marginStart={40}
                marginEnd={40}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
            >
                <GtkLabel label="Welcome to GTKX!" cssClasses={["title-1"]} />
                <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} />
                <GtkButton
                    label="Increment"
                    onClicked={() => setCount((c) => c + 1)}
                    cssClasses={["suggested-action", "pill"]}
                />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export const App = () => (
    <GtkApplication>
        <MainWindow />
    </GtkApplication>
);

export default App;
```

**`src/index.tsx`** — Application entry consumed by both `gtkx dev` and `gtkx build`. It imports `App` and renders it with a single argument; the `GtkApplication` component inside `App` owns the application:

```tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

render(<App />);
```

**`gtkx.config.ts`** — Project configuration including the application identifier and optional flags:

```ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    applicationId: "com.example.myapp",
    libraries: ["Gtk-4.0", "Adw-1"],
});
```

## Run the development server

Start the development server with hot reload:

```bash
npm run dev
```

This starts your application with Hot Module Replacement (HMR). When you edit your components, changes appear instantly without losing application state.

## Build for production

Bundle your application into a single minified file:

```bash
npm run build
npm start
```

This runs `gtkx build` to produce `dist/bundle.js` via Vite SSR mode, then `node dist/bundle.js` to run it.

## Run tests

If you enabled testing:

```bash
npm test
```

Tests run in a real GTK environment using the `@gtkx/vitest` plugin, which automatically manages Xvfb displays for headless execution.

## Understanding the basics

### Intrinsic elements

Intrinsic elements are imported as constants from `@gtkx/react` and correspond to GTK widgets or event controllers. They accept props that map to GTK properties, signals, and child widgets.

#### Widget example

```tsx
import { GtkButton, GtkEntry } from "@gtkx/react";

<GtkButton>Click me</GtkButton>
<GtkEntry placeholderText="Type here" />
```

#### Event controller example

Event controllers and gestures attach through the widget's `addController` prop (wrap several in a fragment):

```tsx
import { GtkBox, GtkLabel, GtkEventControllerMotion, GtkEventControllerKey } from "@gtkx/react";
import { useState } from "react";

const InteractiveBox = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    return (
        <GtkBox
            focusable
            addController={
                <>
                    <GtkEventControllerMotion
                        onEnter={(x, y) => console.log("Entered at", x, y)}
                        onMotion={(x, y) => setPosition({ x, y })}
                        onLeave={() => console.log("Left")}
                    />
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            console.log("Key:", keyval);
                            return false;
                        }}
                    />
                </>
            }
        >
            <GtkLabel label={`Position: ${Math.round(position.x)}, ${Math.round(position.y)}`} />
        </GtkBox>
    );
};
```

## What's next?

- [FFI Bindings](./ffi-bindings.md) — Using GTK and GLib bindings
- [Styling](./styling.md) — CSS-in-JS for GTK
- [Testing](./testing.md) — Testing your components
- [Tutorial](./tutorial/1-window-and-header-bar.md) — Build a complete Notes app step by step
