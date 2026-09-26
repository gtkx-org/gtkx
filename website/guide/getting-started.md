---
title: "Getting Started"
description: "Install the prerequisites, create a GTKX app, and run the development loop."
---

# Getting Started

Create a Linux desktop app with React and TypeScript, then edit it while its window stays open. This guide uses GTKX 1.6.

## What you need

GTKX requires Linux, Node.js 24 or later, GTK 4.20 or later, libadwaita 1.8 or later, and GLib development files. Prebuilt GTKX binaries support x64 and arm64 Linux with glibc.

Install [Node.js](https://nodejs.org/en/download) with your preferred version manager, then check the version in the terminal you will use for development:

```bash
node --version
```

### Native libraries on Fedora 44

Install the development packages, which supply both native libraries and the GIR files used to generate bindings:

```bash
sudo dnf install gtk4-devel libadwaita-devel glib2-devel gobject-introspection-devel pkgconf-pkg-config
```

The package names are listed in Fedora's [GTK](https://packages.fedoraproject.org/pkgs/gtk4/gtk4-devel/), [libadwaita](https://packages.fedoraproject.org/pkgs/libadwaita/libadwaita-devel/), and [GObject Introspection](https://packages.fedoraproject.org/pkgs/gobject-introspection/gobject-introspection-devel/) package documentation. Check the installed versions:

```bash
pkg-config --modversion gtk4 libadwaita-1 glib-2.0
```

This setup was checked in a fresh Fedora 44 container with Node.js 26.8.2, GTK 4.22.5, libadwaita 1.9.4, and GLib 2.88.3. A project created from the published GTKX 1.6.0 packages passed typechecking, build, and its scaffolded test. Its counter window was also opened and exercised in a graphical session.

Other distributions need equivalent development packages meeting the minimum versions above. See [GTK's Linux installation guide](https://www.gtk.org/docs/installations/linux) for package names. A runtime-only package is insufficient for code generation.

Run the app from a graphical desktop session. In a development container, the container also needs access to the session's display and D-Bus; installing libraries alone does not provide that connection.

## Scaffolding a new app

::: code-group

```bash [npm]
npm create gtkx@1.6.0
```

```bash [pnpm]
pnpm create gtkx@1.6.0
```

```bash [yarn]
yarn create gtkx@1.6.0
```

:::

Choose a project directory, an application ID such as `com.example.MyApp`, and your package manager. Enable TypeScript and the Vitest setup to follow the tutorial. Then run:

```bash
cd my-app
npm run dev
```

The 1.6 starter is a GTK counter. The tutorial replaces its shell with an Adwaita application window. Click the button to increase the count. Change its label in `src/app.tsx` and save; the open window should update.

## The dev loop

`npm run dev` runs `gtkx dev`. Fast Refresh updates edited components in the open window. Changes it cannot patch restart the app.

| Command | Result |
| --- | --- |
| `npm run dev` | Run the app and watch source files |
| `npm run build` | Bundle the app into `dist/bundle.mjs` |
| `npm start` | Run that production bundle with Node.js |
| `npm run deploy` | Build a distributable package; see [Deploying](/guide/deploying) |

The production bundle still needs the native runtime libraries. Packaging can supply a Node.js runtime and desktop integration files.

## Project structure

```text
my-app/
├─ gtkx.config.ts
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│  ├─ index.tsx
│  ├─ app.tsx
│  └─ gtkx-env.d.ts
└─ tests/
   └─ app.test.tsx
```

`gtkx.config.ts` holds the application ID and library configuration. The component lives in `src/app.tsx`; `src/index.tsx` renders it. The testing files are included when you enable Vitest during setup.

## The entry point: `src/index.tsx`

Create a React root and render your application. GTKX supplies the native root container, so `createRoot()` takes no DOM element:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

The starter's `<GtkApplication>` gets its application ID from `gtkx.config.ts`. [Create a Window](/tutorial/your-first-window) explains the application, window, and close handler.

## Troubleshooting

- **Missing GIR file:** install the library's development package, then run `npx gtkx codegen` from the project. For libraries outside the standard directories, set [`girPath`](/guide/configuration-and-codegen#the-config-file).
- **Native versions are too old:** use a distribution or development container that meets the minimums. Installing newer TypeScript packages does not upgrade GTK or libadwaita.
- **No display connection:** run from a desktop terminal or configure your container's display and session access. Tests have a separate [headless setup](/guide/testing#setup).
- **Dependency installation failed:** the generated files remain in the project directory. Resolve the package manager's error and rerun its install command there. For pnpm release-age restrictions, see the [pnpm settings](https://pnpm.io/settings/dependency-resolution#minimumreleaseage).

## Next

- [Tutorial](/tutorial/): build Tasks, a task manager with persistence, navigation, and packaging.
- [Configuration and Codegen](/guide/configuration-and-codegen): select native libraries and understand generated imports.
