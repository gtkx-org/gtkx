# GTK demo

A React port of the official GTK4 widget showcase, demonstrating the breadth of widgets GTKX renders as real GObject instances.

## What it shows

This app mirrors the upstream `gtk-demo` browser. A `GtkApplicationWindow` holds a searchable sidebar of demos and a `GtkNotebook` with an info tab and a live source viewer. Selecting a demo and pressing Run opens it in its own `GtkWindow` through a React portal (`createPortal`).

The example exercises a wide span of the toolkit:

- Widgets across the catalog, plus Libadwaita dialogs (`AdwAboutDialog`, `Adw.ShortcutsDialog`) and a `GtkSource` view for the source viewer.
- Global keyboard shortcuts via `GtkShortcutController` and `GtkShortcut`.
- Menus built from `MenuSection` and `MenuItem`, opening the GTK Inspector and the shortcuts dialog.
- Hooks from `@gtkx/react` — `useApplication` and `useProperty` — to read the application's active window reactively.
- CSS-in-JS styling through `@gtkx/css`.

`gtkx.config.ts` declares three GIR libraries: `Gtk-4.0`, `Adw-1`, and `GtkSource-5`.

## Prerequisites

GTKX needs Node 24+, pnpm 11, and a GTK4 runtime; this example also requires Libadwaita and GtkSourceView 5 on the system. See https://gtkx.dev for the full system requirements.

## How to run

Install dependencies from the repository root, then start the dev server in this directory:

```bash
pnpm install
pnpm --filter gtk-demo dev
```

`gtkx dev` runs a Vite dev server with React Fast Refresh, so source edits apply live through HMR.

To produce and run a production build:

```bash
pnpm --filter gtk-demo build
pnpm --filter gtk-demo start
```

`gtkx build` emits `dist/bundle.js` and `dist/gtkx.node`; `start` runs the bundle with `node`. The package also ships a Vitest suite (`pnpm --filter gtk-demo test`) built on `@gtkx/testing`.

## Learn more

Full guides and API reference live at https://gtkx.dev.
