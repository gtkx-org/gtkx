# Getting started

This guide walks you through creating your first GTKX application.

## Install system dependencies

GTKX renders to real GTK widgets and generates its TypeScript bindings from the GObject Introspection (GIR) XML on your system, so the GTK4, libadwaita, and gobject-introspection development files must be installed before you create a project. The development packages install the GIR XML under `/usr/share/gir-1.0`, which is where codegen reads it.

::: code-group

```bash [Ubuntu / Debian]
sudo apt install libgtk-4-dev libadwaita-1-dev libgirepository1.0-dev gobject-introspection
```

```bash [Fedora]
sudo dnf install gtk4-devel libadwaita-devel gobject-introspection-devel
```

```bash [Arch]
sudo pacman -S gtk4 libadwaita gobject-introspection
```

:::

GTKX requires **GTK 4.22 or newer** and **Node.js 24 or newer**. Verify your GTK version with:

```bash
pkg-config --modversion gtk4
```

## Create a new project

The fastest way to start is with the GTKX CLI:

```bash
npx @gtkx/cli@latest create my-app
```

The CLI will prompt you for:

- **Project name** — lowercase letters, numbers, and hyphens
- **Application ID** — reverse domain notation (e.g., `com.example.myapp`)
- **Package manager** — pnpm (recommended), npm, or yarn
- **Testing** — whether to include Vitest testing setup
- **Claude Code skills** — optional helper files for AI code generation

After the prompts, the CLI creates your project, installs dependencies, and initializes a git repository.

## Project structure

A new GTKX project has this structure:

```
my-app/
├── src/
│ ├── app.tsx # Main application component
│ ├── index.tsx # Entry that mounts the app, used by `gtkx dev` and `gtkx build`
│ └── gtkx-env.d.ts # Type references for the generated bindings
├── tests/
│ └── app.test.tsx # Example test (with testing enabled)
├── gtkx.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts # Vitest setup (with testing enabled)
```

### Key files

**`src/app.tsx`** — The default app component (just an example, can be removed or renamed). The `App` component wraps the window in a `GtkApplication`, which owns the application; its `applicationId` is passed explicitly, read from the resolved `gtkx.config.ts` through `@gtkx/config/runtime`. It is provided as both a named export `App` and the default export:

```tsx
import { applicationId } from "@gtkx/config/runtime";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const MainWindow = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow
            title="My App"
            defaultWidth={400}
            defaultHeight={300}
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
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
    <GtkApplication applicationId={applicationId}>
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

**`gtkx.config.ts`** — Project configuration: the GIR libraries to generate bindings for and the application identifier:

```ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.example.myapp",
});
```

## Run the development server

Start the development server with hot reload:

::: code-group

```bash [npm]
npm run dev
```

```bash [pnpm]
pnpm dev
```

```bash [yarn]
yarn dev
```

:::

This starts your application with Hot Module Replacement (HMR). When you edit your components, changes appear instantly without losing application state.

## Build for production

Bundle your application into a single minified file:

::: code-group

```bash [npm]
npm run build
npm start
```

```bash [pnpm]
pnpm build
pnpm start
```

```bash [yarn]
yarn build
yarn start
```

:::

This runs `gtkx build` to produce `dist/bundle.js` via Vite SSR mode, then `node dist/bundle.js` to run it.

## Run tests

If you enabled testing:

::: code-group

```bash [npm]
npm test
```

```bash [pnpm]
pnpm test
```

```bash [yarn]
yarn test
```

:::

Tests run in a real GTK environment using the `@gtkx/vitest` plugin, which automatically manages Xvfb displays for headless execution.

::: tip
Headless test runs need Xvfb installed: `sudo apt install xvfb` on Ubuntu/Debian, `sudo dnf install xorg-x11-server-Xvfb` on Fedora.
:::

Next, read [Thinking in GTKX](/docs/thinking-in-gtkx) to learn how React trees become GTK widgets and how props map to properties, signals, and children.

## Troubleshooting

**Codegen cannot find a `.gir` file.** Errors mentioning a missing `Gtk-4.0.gir` or `Adw-1.gir` mean the GIR XML is not installed. It ships with the development packages listed under [Install system dependencies](#install-system-dependencies); install them and rerun. Codegen reads `/usr/share/gir-1.0`, or any directory reported by `pkg-config --variable=girdir gobject-introspection-1.0`.

**GTK is older than 4.22.** Run `pkg-config --modversion gtk4`. GTKX targets GTK 4.22; older releases lack APIs the generated bindings call. Upgrade to a distribution release that ships GTK 4.22 or newer.

**Node.js is older than 24.** Run `node --version`; it must report v24 or later. Install a current release through your distribution or a version manager.

**Wayland or X11.** GTKX apps run on both. GTK picks the session's display backend automatically; set `GDK_BACKEND=wayland` or `GDK_BACKEND=x11` to select one explicitly.

## Where to next

- [Thinking in GTKX](/docs/thinking-in-gtkx) — How GTKX maps React onto GTK
- [Tutorial](/docs/tutorial/1-window-and-header-bar) — Build a complete Notes app step by step
- [Styling](/docs/styling) — CSS-in-JS for GTK
- [Testing](/docs/testing) — Testing your components
