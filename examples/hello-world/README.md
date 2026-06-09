# Hello world

The canonical minimal GTKX application: a counter window built with React 19 and real GTK4 widgets.

## What it shows

This is the smallest complete GTKX app, the reference every other example builds on. Three source files cover the whole surface:

- `gtkx.config.ts` declares the single GIR library this app needs, `Gtk-4.0`.
- `src/index.tsx` calls `render(<App />)` from `@gtkx/react`.
- `src/app.tsx` wraps a `GtkApplicationWindow` in a `GtkApplication` component and renders a `GtkBox` with two `GtkLabel` widgets and a `GtkButton`.

State lives in a plain React `useState` hook. Clicking the button increments the counter and the label updates, the same component model you already know, driving real GObject widgets. Styling comes from GTK CSS classes (`title-1`, `suggested-action`, `pill`) passed through the `cssClasses` prop.

## Prerequisites

GTKX needs Node 24+, pnpm 11, and a GTK4 runtime. See the setup guide at https://gtkx.dev for the full system requirements.

## How to run

Install dependencies from the repository root, then start the dev server in this directory:

```bash
pnpm install
pnpm --filter hello-world dev
```

`gtkx dev` runs a Vite dev server with React Fast Refresh, so edits to `src/app.tsx` apply live through HMR while the window stays open.

To produce and run a production build:

```bash
pnpm --filter hello-world build
pnpm --filter hello-world start
```

`gtkx build` emits `dist/bundle.js` and `dist/gtkx.node`; `start` runs the bundle with `node`.

## Learn more

Full guides and API reference live at https://gtkx.dev.
