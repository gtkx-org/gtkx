# Browser

A minimal web browser built on a real `WebKitWebView`, wrapped in a Libadwaita window.

## What it shows

This example renders a `WebKitWebView` as a GTKX component and drives it from React state:

- An `AdwApplicationWindow` with an `AdwToolbarView` and `AdwHeaderBar` holding a URL entry and back, forward, and reload/stop buttons.
- A `WebKitWebView` whose navigation history, current URL, and load state flow into a `useState` controller through the `onLoadChanged` signal and GObject `notify` callbacks.
- A `GtkProgressBar` reflecting the estimated load progress, hidden between loads through a `@gtkx/css` class toggle.
- Imperative WebKit calls (`loadUri`, `goBack`, `goForward`, `reload`, `stopLoading`) made through a widget ref.

`gtkx.config.ts` declares the GIR libraries this app needs, including the WebKit binding:

```ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0", "WebKit-6.0"],
});
```

## Prerequisites

GTKX needs Node 24+, pnpm 11, and a GTK4 runtime. This example additionally requires WebKitGTK with its GIR data installed, so that codegen can read the `WebKit-6.0` GIR and the app can resolve the WebKit shared library at runtime. See https://gtkx.dev for the full system requirements.

## How to run

Install dependencies from the repository root, then start the dev server in this directory:

```bash
pnpm install
pnpm --filter browser dev
```

`gtkx dev` runs a Vite dev server with React Fast Refresh, so source edits apply live through HMR.

To produce and run a production build:

```bash
pnpm --filter browser build
pnpm --filter browser start
```

`gtkx build` emits `dist/bundle.js` and `dist/gtkx.node`; `start` runs the bundle with `node`.

## Learn more

Full guides and API reference live at https://gtkx.dev.
