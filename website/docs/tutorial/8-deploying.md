# 8. Deploying

Your Notes app is complete. Let's package it for distribution as a native Linux application.

## Overview

Distributing a GTKX application involves three steps:

1. **Bundle** the JavaScript code with `gtkx build`
2. **Re-bundle for SEA** — convert the ESM output to CJS for Node.js Single Executable Applications
3. **Package** with Flatpak, Snap, or distro-specific tools

## Bundle with `gtkx build`

Run the production bundler to create a single minified ESM bundle:

```bash
npx gtkx build
```

This produces:

- `dist/bundle.js` — all dependencies inlined
- `dist/gtkx.node` — the native GTK4 bindings (copied automatically)
- `dist/gschemas.compiled` — compiled GSettings schemas (if any `.gschema.xml` files are imported)

## Re-Bundle for SEA

Node.js SEA requires a CommonJS entry point. Use esbuild to re-bundle the ESM output, shimming the native module to load from the executable's directory:

```ts
// scripts/bundle.ts
import { join, resolve } from "node:path";
import * as esbuild from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");

const nativeShim = `
const { createRequire } = require("node:module");
const { dirname, join } = require("node:path");

const execDir = dirname(process.execPath);
const require2 = createRequire(join(execDir, "package.json"));
module.exports = require2("./gtkx.node");
`;

await esbuild.build({
    entryPoints: [join(projectRoot, "dist/bundle.js")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: join(projectRoot, "dist/bundle.cjs"),
    minify: true,
    banner: {
        js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
    define: {
        "import.meta.url": "__import_meta_url",
    },
    plugins: [
        {
            name: "native-shim",
            setup(build) {
                build.onResolve({ filter: /\.\/gtkx\.node$/ }, (args) => ({
                    path: args.path,
                    namespace: "native-shim",
                }));
                build.onLoad({ filter: /.*/, namespace: "native-shim" }, () => {
                    return { contents: nativeShim, loader: "js" };
                });
            },
        },
    ],
});
```

The `native-shim` plugin replaces the `gtkx.node` import with a runtime loader that finds the native module relative to `process.execPath` — this is critical for SEA binaries where the bundle is embedded in the executable.

## Single Executable Application (SEA)

### SEA Configuration

Create `sea-config.json`:

```json
{
    "main": "dist/bundle.cjs",
    "output": "dist/sea-prep.blob",
    "disableExperimentalSEAWarning": true,
    "useCodeCache": true
}
```

### Build Script

```bash
#!/bin/bash
set -e

# Generate SEA blob
node --experimental-sea-config sea-config.json

# Copy node binary
cp $(which node) dist/app

# Inject blob into binary
npx postject dist/app NODE_SEA_BLOB dist/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

chmod +x dist/app
```

The final distribution includes:

- `dist/app` — The executable
- `dist/gtkx.node` — The native GTK4 bindings
- `dist/gschemas.compiled` — Compiled settings schemas (if using GSettings)

## Flatpak Packaging

Flatpak is the recommended format for Linux desktop applications. The manifest builds the SEA binary inside the Flatpak sandbox using the Node.js SDK extension:

```yaml
# flatpak/com.gtkx.tutorial.yaml
app-id: com.gtkx.tutorial
runtime: org.gnome.Platform
runtime-version: "48"
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.node22
command: gtkx-tutorial
finish-args:
  - --share=ipc
  - --socket=fallback-x11
  - --socket=wayland
  - --device=dri

build-options:
  append-path: /usr/lib/sdk/node22/bin
  env:
    npm_config_nodedir: /usr/lib/sdk/node22
  no-debuginfo: true
  strip: false

modules:
  - name: gtkx-tutorial
    buildsystem: simple
    build-commands:
      - node --experimental-sea-config sea-config.json
      - cp /usr/lib/sdk/node22/bin/node app
      - node vendor/postject.cjs app NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
      - install -Dm755 app /app/bin/gtkx-tutorial
      - install -Dm755 dist/gtkx.node /app/bin/gtkx.node
      - install -Dm644 dist/gschemas.compiled /app/bin/gschemas.compiled
      - install -Dm644 flatpak/com.gtkx.tutorial.desktop /app/share/applications/com.gtkx.tutorial.desktop
      - install -Dm644 flatpak/com.gtkx.tutorial.metainfo.xml /app/share/metainfo/com.gtkx.tutorial.metainfo.xml
      - install -Dm644 assets/icon.png /app/share/icons/hicolor/256x256/apps/com.gtkx.tutorial.png
    sources:
      - type: dir
        path: ..
        skip:
          - .flatpak-builder
          - build-dir
          - flatpak-repo
          - node_modules
```

### GSettings in Flatpak

The `gtkx build` step compiles imported `.gschema.xml` files into `dist/gschemas.compiled`. The manifest installs this file next to the binary at `/app/bin/gschemas.compiled`. At runtime, the GTKX GSettings plugin sets `GSETTINGS_SCHEMA_DIR` to the binary's directory automatically — no additional configuration needed.

### Building

```bash
# Bundle the app and create the CJS re-bundle
gtkx build && tsx scripts/bundle.ts

# Build the Flatpak
flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo=flatpak-repo \
    build-dir \
    flatpak/com.gtkx.tutorial.yaml

# Create an installable bundle
flatpak build-bundle \
    flatpak-repo \
    dist/com.gtkx.tutorial.flatpak \
    com.gtkx.tutorial
```

## Snap Packaging

Snap is an alternative format, popular on Ubuntu:

```yaml
# snap/snapcraft.yaml
name: gtkx-tutorial
version: "0.1.0"
base: core24
confinement: strict

apps:
    gtkx-tutorial:
        command: bin/gtkx-tutorial
        extensions: [gnome]

parts:
    gtkx-tutorial:
        plugin: dump
        source: dist/
        organize:
            app: bin/gtkx-tutorial
            gtkx.node: bin/gtkx.node
            gschemas.compiled: bin/gschemas.compiled
```

For complete Snap setup, see the [Snapcraft Documentation](https://snapcraft.io/docs).

## What's Next?

Congratulations! You've built a complete Notes application that follows the [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/), covering:

- **Compound components** — `AdwToolbarView.AddTopBar`, `AdwHeaderBar.PackStart`, and more
- **Slot props** — `titleWidget`, `popover`, and other widget properties
- **CSS-in-JS styling** — `@gtkx/css` with GTK CSS variables
- **Virtualized lists** — `GtkListView` and `GtkColumnView` with tree support
- **Menus and shortcuts** — `GtkMenuButton.MenuItem` and `GtkShortcutController.Shortcut`
- **Navigation** — `AdwNavigationSplitView`, `AdwNavigationView`, `AdwViewStack`
- **Search** — `GtkSearchBar` and `GtkSearchEntry` for filtering content
- **Dialogs** — `AdwAlertDialog` and `AdwAboutDialog` with portals
- **Toast notifications** — `AdwToastOverlay` with undo support
- **Animations** — `AdwTimedAnimation` and `AdwSpringAnimation`
- **Empty states** — `AdwStatusPage` for placeholder views
- **Settings** — `useSetting` with GSettings schemas
- **Deployment** — SEA bundling, Flatpak, and Snap packaging

Explore the [API Reference](/api/react/) for the complete API surface, or check out the [CLI Reference](../cli.md) and [MCP Integration](../mcp.md) docs.
