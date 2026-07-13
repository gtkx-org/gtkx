---
description: "Scaffold a GTKX app with npm create gtkx, meet the CLI and the dev loop, and watch a real GTK4 window hot-reload as you edit TypeScript."
---

# Getting Started

Before we open a single component, let's set up the project the Tasks app lives in and get comfortable with the loop you'll run for the rest of the tutorial: edit a `.tsx` file, save, watch a real GTK4 window update. gtkx apps are ordinary Node projects. There is no webview, no Electron main/renderer split, and no bundler config to hand-write. The `gtkx` CLI wraps Vite, reads GObject-Introspection for GTK and libadwaita, and hands you typed React bindings for the entire native widget set.

## What you need

gtkx is Linux-only, because it renders through the system's real GTK4 and libadwaita. You need:

- Linux with the GTK4, libadwaita, and GLib development libraries installed
- Node.js 24 or later

The native addon (`@gtkx/native`) ships prebuilt for the common Linux architectures. On anything else it compiles from source, which needs a Rust toolchain.

## Scaffolding a new app

Start any new project with the official initializer:

::: code-group

```bash [npm]
npm create gtkx@latest
```

```bash [pnpm]
pnpm create gtkx
```

```bash [yarn]
yarn create gtkx
```

```bash [bun]
bun create gtkx
```

:::

It prompts for a few things:

- **Project directory** (for example `my-app`)
- **Application ID** in reverse-domain notation (for example `com.example.myapp`). This is the D-Bus name GNOME uses to identify your app, so it must look like `com.gtkx.tutorial`, not `tutorial`.
- **Package manager**
- **Use TypeScript?** and **Include testing setup (Vitest)?**

Then:

```bash
cd my-app
npm run dev
```

A window opens. The generated starter is a tiny counter, its `src/app.tsx` renders a `GtkApplicationWindow` with a `GtkLabel` and a `GtkButton` whose `onClicked` bumps `useState`. That is the whole "hello world": React state driving a real GTK button. This tutorial builds the Tasks app on top of that same skeleton, so the structure below is what you'll be working in.

::: tip
The finished Tasks app you'll study lives at `examples/tutorial` in the gtkx repository. Every snippet in this tutorial is copied from that source. You can run it, read ahead, or diff your work against it at any point.
:::

## Project structure

A gtkx project is small. Here is the shape the Tasks app uses:

```
tutorial/
├─ gtkx.config.ts        # app id + which native libraries to bind
├─ package.json          # scripts, deps, the #data/* import
├─ tsconfig.json
├─ data/
│  └─ com.gtkx.tutorial.gschema.xml   # GSettings schema (preferences)
└─ src/
   ├─ index.tsx          # entry point: createRoot().render(<App/>)
   ├─ app.tsx            # the AdwApplication + window shell
   ├─ gtkx-env.d.ts      # ambient type references
   ├─ types.ts           # the Task / TaskList data shapes
   ├─ store.ts           # JSON persistence in the XDG data dir
   ├─ components/        # sidebar, task-list, task-row, task-detail, dialogs, ...
   └─ hooks/             # use-tasks, use-reminders
```

You will not find a `@gtkx/gi` or `@gtkx/jsx` folder checked in anywhere. Those are the typed native bindings, and they are **generated** into `node_modules/.gtkx` (more on that below), which is git-ignored along with `node_modules` and `dist`. That directory is why importing from `@gtkx/jsx/gtk` resolves even though you never installed it as a dependency.

## Configuration: `gtkx.config.ts`

The whole config for the Tasks app is six lines:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

`applicationId` is the only required field. It's your reverse-DNS app ID, and it does double duty: it becomes the default for the top-level `<AdwApplication>` (you never pass the ID again in your JSX), and it's the identity GNOME, GSettings, and notifications key off.

`libraries` is a list of GObject-Introspection namespaces in `Name-Version` form. `"Gtk-4.0"` and `"Adw-1"` (GTK 4 and libadwaita 1) are what every app in this tutorial needs. The CLI reads the GIR typelibs for exactly these libraries and generates the bindings you import, so this list determines which widgets exist under `@gtkx/jsx/*` and `@gtkx/gi/*`. Add a namespace here (say `"WebKit-6.0"`) and its classes become available after the next codegen.

## The entry point: `src/index.tsx`

Mounting a gtkx tree looks exactly like React DOM, minus the DOM node:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

`createRoot()` from `@gtkx/react` returns a root with the familiar `render(element)` / `unmount()` pair. There's no container argument to pass because the "container" is the native application itself, not an element in a page. `<App />` is your top-level component. The counter starter wrapped its window in `<GtkApplication>`; the Tasks app swaps that for `<AdwApplication>` (imported from `@gtkx/jsx/adw`) to pull in libadwaita. Constructing that `Adw.Application` calls `adw_init` and sets up the libadwaita style manager, and it picks up the `applicationId` from your config automatically.

::: info
Note the `./app.js` import specifier even though the file is `app.tsx`. The project uses `"module": "NodeNext"`, which follows Node's ESM resolution: you write the `.js` extension the compiler emits, and it resolves the `.tsx` source.
:::

## Ambient types: `src/gtkx-env.d.ts`

This file wires up the types for things that aren't plain modules, asset imports and your generated GSettings schemas:

```ts
/// <reference types="@gtkx/cli/env" />
/// <reference path="../node_modules/.gtkx/env.d.ts" />
```

The first reference pulls in `vite/client` plus type declarations for every asset kind you can import (`*.png`, `*.svg`, `*.css?url`, and so on), each typed as a resource module. The second points at a **generated** file: codegen writes `node_modules/.gtkx/env.d.ts` with a typed module declaration for each `#data/*.gschema.xml` schema, so `import schema from "#data/com.gtkx.tutorial.gschema.xml"` is fully typed. That generated file doesn't exist until you've run the CLI once; the reference is harmless before then and lights up afterward.

## `tsconfig.json`

Standard modern TypeScript, with `react-jsx` so you don't import React in every file:

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "jsx": "react-jsx",
        "strict": true,
        "skipLibCheck": true,
        "resolveJsonModule": true,
        "outDir": "out-tsc",
        "rootDir": "src"
    },
    "include": ["src/**/*"]
}
```

## `package.json`: scripts and dependencies

```json
{
    "name": "gtkx-tutorial",
    "type": "module",
    "imports": {
        "#data/*": "./data/*"
    },
    "scripts": {
        "dev": "gtkx dev",
        "build": "gtkx build",
        "codegen": "gtkx codegen",
        "typecheck": "gtkx codegen && tsc --noEmit",
        "start": "node dist/bundle.js"
    },
    "dependencies": {
        "@gtkx/animate": "^0.21.0",
        "@gtkx/components": "^0.21.0",
        "@gtkx/css": "^0.21.0",
        "@gtkx/react": "^0.21.0",
        "react": "^19.2.7"
    },
    "devDependencies": {
        "@gtkx/cli": "^0.21.0",
        "@gtkx/config": "^0.21.0"
    }
}
```

The runtime dependencies map onto the pieces you'll use throughout the tutorial:

- **`@gtkx/react`** ships the reconciler and the hooks (`createRoot`, `useApplication`, `useSetting`, `useSignal`, `createPortal`, `quit`, ...).
- **`@gtkx/components`** provides higher-level React components over the harder GTK APIs, notably the model-view widgets `ListView`, `ColumnView`, `GridView`, `DropDown`, and `Menu`.
- **`@gtkx/css`** is CSS-in-JS for GTK's CSS (a `css` tagged template that feeds a widget's `cssClasses`).
- **`@gtkx/animate`** adds declarative enter/exit animations backed by libadwaita's animation engine.
- **`react`** is plain React 19. gtkx is a custom renderer, not a fork.

`@gtkx/cli` and `@gtkx/config` are dev-only: the CLI is the `gtkx` binary, and `@gtkx/config` provides `defineConfig`.

Two things are conspicuously absent from `dependencies`: **`@gtkx/gi` and `@gtkx/jsx`**. Those are the typed native bindings, and they aren't installed, they're generated into `node_modules/.gtkx` by codegen (next section). The `"imports": { "#data/*": "./data/*" }` map is how `import ... from "#data/..."` resolves your `data/` directory; it's also how the CLI discovers your GSettings schemas.

## The dev loop: the `gtkx` CLI

Three commands cover everything:

```bash
gtkx dev        # dev server with Fast Refresh
gtkx build      # production bundle in dist/
gtkx codegen    # (re)generate the native bindings
```

**`gtkx dev`** is what you'll run while building the app. It starts a Vite dev server wired to a supervisor that launches your GTK app and hot-reloads it. Edit a component, save, and the running window updates in place with React Fast Refresh: your `useState` survives the reload, so you don't lose the task you were mid-edit on. It also watches `gtkx.config.ts` and your schemas.

**`gtkx build`** produces a self-contained `dist/bundle.js`, alongside the native addon (`dist/gtkx.node`) and, when you have GSettings schemas, a compiled `dist/gschemas.compiled`. `npm start` (`node dist/bundle.js`) runs that bundle directly.

**`gtkx codegen`** is the piece that makes gtkx feel native-typed. It reads the GObject-Introspection data for every library in `gtkx.config.ts` and emits, in one pass:

- **`@gtkx/gi/<lib>`** (into `node_modules/.gtkx/gi`): the raw GI classes, enums, and functions, for example `import * as Gtk from "@gtkx/gi/gtk"`, used for refs, enums like `Gtk.Orientation.VERTICAL`, and imperative calls.
- **`@gtkx/jsx/<lib>`** (into `node_modules/.gtkx/jsx`): the React host components, one PascalCase export per widget, for example `import { GtkBox, GtkButton } from "@gtkx/jsx/gtk"` and `import { AdwApplication } from "@gtkx/jsx/adw"`.

Because the same generator emits the TypeScript types and the underlying FFI calls together, from one GIR, the types can't drift from the calls they back, and they cover the whole GTK4 and libadwaita surface rather than a hand-picked subset.

You rarely run `codegen` by hand: `gtkx dev` and `gtkx build` regenerate the bindings automatically when they're stale (a fingerprint check skips it when nothing changed). The one place it's explicit is typechecking, where the bindings must exist before `tsc` runs:

```json
"typecheck": "gtkx codegen && tsc --noEmit"
```

::: tip
If your editor can't resolve `@gtkx/jsx/gtk` or `#data/...` right after cloning, run `npm run codegen` (or just `npm run dev` once) to populate `node_modules/.gtkx`, then restart the TypeScript server.
:::

With the project scaffolded and the dev loop running, you're ready to build the real UI.

## Next

Continue to [The Application Shell](/tutorial/app-shell), where the counter starter becomes an adaptive `AdwApplicationWindow` with a navigation split view.
