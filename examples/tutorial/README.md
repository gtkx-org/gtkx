# Tutorial

The Notes app from the GTKX tutorial: a Libadwaita notes manager with categories, search, trash, and persisted preferences.

## What it shows

This is the application the tutorial at https://gtkx.dev builds step by step. It is a real Adwaita app:

- An `AdwApplicationWindow` with an `AdwNavigationSplitView` — a category sidebar (All, Favorites, Recent, Trash) beside a content pane.
- List and grid views over the notes (`GtkListView`, `GtkGridView`) with single selection, switched through an `AdwToggleGroup`.
- A note editor, search through `GtkSearchBar` and `GtkSearchEntry`, and `AdwStatusPage` empty states.
- Soft delete to Trash with an undo `Adw.Toast`, plus a permanent-delete confirmation dialog.
- Global keyboard shortcuts (`GtkShortcutController`), an `AdwAboutDialog`, and a preferences dialog.
- Persisted settings through GSettings: the `useSetting` hook from `@gtkx/react` reads `compact-mode` and `font-size` from the `com.gtkx.tutorial` schema (`com.gtkx.tutorial.gschema.xml`).
- Styling through `@gtkx/css`.

`gtkx.config.ts` declares two GIR libraries: `Gtk-4.0` and `Adw-1`.

## Prerequisites

GTKX needs Node 24+, pnpm 11, and a GTK4 runtime; this example also requires Libadwaita on the system. See https://gtkx.dev for the full system requirements. The packaging scripts below additionally need `flatpak-builder` (for Flatpak) and a Node binary that supports Single Executable Applications (for the SEA build).

## How to run

Install dependencies from the repository root, then start the dev server in this directory:

```bash
pnpm install
pnpm --filter tutorial dev
```

`gtkx dev` runs a Vite dev server with React Fast Refresh, so source edits apply live through HMR.

To produce and run a production build:

```bash
pnpm --filter tutorial build
pnpm --filter tutorial start
```

`gtkx build` emits `dist/bundle.js` and `dist/gtkx.node`; `start` runs the bundle with `node`.

## Packaging

The tutorial demonstrates two ways to ship the app as a standalone artifact.

### Single executable application

```bash
pnpm --filter tutorial bundle          # gtkx build, then esbuild dist/bundle.js into a CJS dist/bundle.cjs
pnpm --filter tutorial bundle:postject  # vendor the postject CLI into vendor/postject.cjs
pnpm --filter tutorial build:sea        # generate the SEA blob and inject it into a copy of the Node binary
```

`bundle` runs `gtkx build` and then `scripts/bundle.ts`, which uses esbuild to flatten `dist/bundle.js` into a single CommonJS file (`dist/bundle.cjs`) and shims the native `gtkx.node` resolution next to the executable. `bundle:postject` (`scripts/bundle-postject.ts`) bundles the `postject` CLI ahead of time. `build:sea` (`scripts/build-sea.sh`) reads `sea-config.json`, produces `dist/sea-prep.blob` via `node --experimental-sea-config`, copies the Node binary to `dist/app`, and injects the blob with postject. The result runs as `./dist/app` alongside `dist/gtkx.node`.

### Flatpak

```bash
pnpm --filter tutorial build:flatpak
```

`build:flatpak` runs `bundle:postject`, then `flatpak/build.sh`, which calls `bundle` and drives `flatpak-builder` over `flatpak/com.gtkx.tutorial.yaml` to produce `dist/com.gtkx.tutorial.flatpak`. Install and run it with:

```bash
flatpak install --user dist/com.gtkx.tutorial.flatpak
flatpak run com.gtkx.tutorial
```

## Learn more

Follow the full tutorial and API reference at https://gtkx.dev.
