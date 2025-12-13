---
sidebar_position: 8
---

# Flatpak Deployment

Deploy your GTKX app as a Flatpak for distribution on Flathub and other Linux platforms.

## Overview

Flatpak is the standard way to distribute desktop applications on Linux. This guide shows how to package a GTKX app using Node.js Single Executable Applications (SEA) within a Flatpak sandbox.

The packaging strategy:

1. **Bundle** TypeScript/JavaScript into a single file with esbuild
2. **Create SEA** by embedding the bundle into a Node.js binary
3. **Package as Flatpak** with the GNOME runtime providing GTK4

## Prerequisites

Install the Flatpak SDK and GNOME runtime:

```bash
# Install flatpak-builder
sudo dnf install flatpak-builder  # Fedora
sudo apt install flatpak-builder  # Ubuntu/Debian

# Add Flathub repository
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install GNOME SDK and runtime
flatpak install flathub org.gnome.Platform//48 org.gnome.Sdk//48
flatpak install flathub org.freedesktop.Sdk.Extension.node22//24.08
```

## Project Structure

A Flatpak-ready GTKX project needs these additional files:

```
my-app/
├── src/
│   ├── app.tsx
│   └── index.tsx
├── scripts/
│   ├── bundle.ts          # esbuild bundler with SEA support
│   └── build-sea.sh       # Standalone SEA build script
├── org.example.myapp.json # Flatpak manifest
├── sea-config.json        # Node.js SEA configuration
├── package.json
└── tsconfig.json
```

## Step 1: Configure SEA

Create `sea-config.json` to configure Node.js Single Executable Applications:

```json
{
    "main": "dist/bundle.cjs",
    "output": "dist/sea-prep.blob",
    "disableExperimentalSEAWarning": true,
    "useCodeCache": false
}
```

## Step 2: Create the Bundle Script

The bundle script uses esbuild to create a single JavaScript file and handles native module loading for SEA environments.

Create `scripts/bundle.ts`:

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const nativeLoaderCode = `
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');

let nativeModule = null;

function getNativeModule() {
    if (nativeModule) return nativeModule;

    let nativePath;
    let isSea = false;

    try {
        const sea = require('node:sea');
        isSea = sea.isSea();
    } catch {}

    if (isSea) {
        nativePath = join(dirname(process.execPath), 'index.node');
    } else {
        nativePath = require.resolve('@gtkx/native/dist/index.node');
    }

    const nativeRequire = createRequire(nativePath);
    nativeModule = nativeRequire(nativePath);
    return nativeModule;
}

module.exports = getNativeModule();
module.exports.default = module.exports;
`;

const nativePlugin: Plugin = {
    name: "native-loader",
    setup(build) {
        build.onResolve({ filter: /^@gtkx\/native$/ }, () => {
            return {
                path: "@gtkx/native",
                namespace: "native-loader",
            };
        });

        build.onLoad({ filter: /.*/, namespace: "native-loader" }, () => {
            return {
                contents: nativeLoaderCode,
                loader: "js",
            };
        });
    },
};

await build({
    entryPoints: [join(projectRoot, "dist/index.js")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: join(projectRoot, "dist/bundle.cjs"),
    plugins: [nativePlugin],
    logLevel: "info",
});

console.log("Bundle created: dist/bundle.cjs");
```

This script solves a key challenge: Node.js SEA cannot embed native `.node` modules, so the bundle includes a loader that finds `index.node` next to the executable at runtime.

## Step 3: Create the Flatpak Manifest

Create `org.example.myapp.json` (replace `org.example.myapp` with your app ID):

```json
{
    "app-id": "org.example.myapp",
    "runtime": "org.gnome.Platform",
    "runtime-version": "48",
    "sdk": "org.gnome.Sdk",
    "sdk-extensions": ["org.freedesktop.Sdk.Extension.node22"],
    "command": "myapp",
    "finish-args": [
        "--share=ipc",
        "--socket=fallback-x11",
        "--socket=wayland",
        "--device=dri"
    ],
    "build-options": {
        "append-path": "/usr/lib/sdk/node22/bin",
        "env": {
            "npm_config_nodedir": "/usr/lib/sdk/node22"
        },
        "no-debuginfo": true,
        "strip": false
    },
    "modules": [
        {
            "name": "myapp",
            "buildsystem": "simple",
            "build-options": {
                "build-args": ["--share=network"]
            },
            "build-commands": [
                "npm install",
                "npm run build",
                "npm run bundle",
                "node --experimental-sea-config sea-config.json",
                "cp /usr/lib/sdk/node22/bin/node myapp",
                "npx postject myapp NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
                "install -Dm755 myapp /app/bin/myapp",
                "install -Dm755 node_modules/@gtkx/native/dist/index.node /app/bin/index.node"
            ],
            "sources": [
                {
                    "type": "dir",
                    "path": ".",
                    "skip": [
                        ".flatpak-builder",
                        "build-dir",
                        "dist",
                        "node_modules"
                    ]
                }
            ]
        }
    ]
}
```

### Key Manifest Settings

| Setting | Purpose |
|---------|---------|
| `runtime: org.gnome.Platform` | Provides GTK4 and other GNOME libraries |
| `sdk-extensions: node22` | Node.js 22 for building (not included in runtime) |
| `strip: false` | Prevents stripping the binary, which would corrupt the SEA blob |
| `--share=ipc` | Required for GTK clipboard and drag-and-drop |
| `--socket=wayland` | Wayland display access |
| `--socket=fallback-x11` | X11 fallback for non-Wayland systems |
| `--device=dri` | GPU access for hardware acceleration |

## Step 4: Update package.json

Add the required scripts and dependencies:

```json
{
    "name": "myapp",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "scripts": {
        "build": "tsc -b",
        "bundle": "node --import tsx scripts/bundle.ts",
        "build:flatpak": "flatpak-builder --user --install --force-clean build-dir org.example.myapp.json",
        "start": "node dist/index.js"
    },
    "dependencies": {
        "@gtkx/ffi": "^0.5.0",
        "@gtkx/react": "^0.5.0",
        "react": "^19.0.0"
    },
    "devDependencies": {
        "@types/react": "^19.0.0",
        "esbuild": "^0.27.0",
        "postject": "^1.0.0-alpha.6",
        "tsx": "^4.0.0",
        "typescript": "^5.0.0"
    }
}
```

## Step 5: Build and Install

Build and install the Flatpak locally:

```bash
npm run build:flatpak
```

This command:

1. Compiles TypeScript to JavaScript
2. Bundles everything into a single CommonJS file
3. Creates the SEA blob
4. Injects the blob into a copy of the Node.js binary
5. Installs the Flatpak to your user installation

Run your app:

```bash
flatpak run org.example.myapp
```

## Standalone SEA Build (Without Flatpak)

For testing or distributing outside of Flatpak, create `scripts/build-sea.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

echo "=== Building SEA ==="
echo "Project: $PROJECT_DIR"
echo "Output: $DIST_DIR"
echo "Node binary: $NODE_BINARY"

if ! grep -q "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2" "$NODE_BINARY"; then
    echo ""
    echo "ERROR: Node.js binary does not have SEA support."
    echo ""
    echo "Distribution-packaged Node.js often lacks the SEA sentinel fuse."
    echo "Download the official Node.js binary from https://nodejs.org and set NODE_BINARY:"
    echo ""
    echo "  wget https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz"
    echo "  tar -xf node-v22.20.0-linux-x64.tar.xz"
    echo "  NODE_BINARY=./node-v22.20.0-linux-x64/bin/node npm run build:sea"
    echo ""
    exit 1
fi

mkdir -p "$DIST_DIR"

echo ""
echo "Step 1: Compiling TypeScript..."
npm run build

echo ""
echo "Step 2: Bundling with esbuild..."
npm run bundle

echo ""
echo "Step 3: Generating SEA blob..."
"$NODE_BINARY" --experimental-sea-config "$PROJECT_DIR/sea-config.json"

echo ""
echo "Step 4: Copying Node.js binary..."
cp "$NODE_BINARY" "$DIST_DIR/myapp"

echo ""
echo "Step 5: Removing code signature (if present)..."
if command -v codesign &> /dev/null; then
    codesign --remove-signature "$DIST_DIR/myapp" 2>/dev/null || true
fi

echo ""
echo "Step 6: Injecting SEA blob..."
npx postject "$DIST_DIR/myapp" NODE_SEA_BLOB "$DIST_DIR/sea-prep.blob" \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo ""
echo "Step 7: Copying native module..."
cp node_modules/@gtkx/native/dist/index.node "$DIST_DIR/"

echo ""
echo "=== Build complete ==="
echo ""
echo "Output files:"
echo "  Executable: $DIST_DIR/myapp"
echo "  Native:     $DIST_DIR/index.node"
echo ""
echo "To run: cd $DIST_DIR && ./myapp"
```

Add the script to `package.json`:

```json
{
    "scripts": {
        "build:sea": "bash scripts/build-sea.sh"
    }
}
```

Run with:

```bash
npm run build:sea
cd dist && ./myapp
```

## Adding Flatpak Metadata

For Flathub submission, add desktop entry and AppStream metadata.

### Desktop Entry

Create `data/org.example.myapp.desktop`:

```ini
[Desktop Entry]
Name=My App
Comment=A GTKX application
Exec=myapp
Icon=org.example.myapp
Terminal=false
Type=Application
Categories=GTK;Utility;
```

### AppStream Metadata

Create `data/org.example.myapp.metainfo.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
    <id>org.example.myapp</id>
    <name>My App</name>
    <summary>A GTKX application</summary>
    <metadata_license>CC0-1.0</metadata_license>
    <project_license>MIT</project_license>
    <description>
        <p>
            A native Linux desktop application built with GTKX and React.
        </p>
    </description>
    <launchable type="desktop-id">org.example.myapp.desktop</launchable>
    <url type="homepage">https://example.com</url>
    <content_rating type="oars-1.1" />
    <releases>
        <release version="1.0.0" date="2025-01-01">
            <description>
                <p>Initial release</p>
            </description>
        </release>
    </releases>
</component>
```

Add installation commands to your manifest's `build-commands`:

```json
"build-commands": [
    "...",
    "install -Dm644 data/org.example.myapp.desktop /app/share/applications/org.example.myapp.desktop",
    "install -Dm644 data/org.example.myapp.metainfo.xml /app/share/metainfo/org.example.myapp.metainfo.xml"
]
```

## Sandbox Permissions

Common permissions for GTKX apps:

| Permission | Purpose |
|------------|---------|
| `--share=ipc` | GTK inter-process communication |
| `--socket=wayland` | Wayland display |
| `--socket=fallback-x11` | X11 fallback |
| `--device=dri` | GPU acceleration |
| `--share=network` | Network access (if needed) |
| `--filesystem=home` | Home directory access (if needed) |
| `--talk-name=org.freedesktop.portal.*` | Portal access for file dialogs, etc. |

Only request permissions your app actually needs.

## Troubleshooting

### SEA Sentinel Fuse Error

If you see "Node.js binary does not have SEA support", your system Node.js was built without the SEA sentinel fuse. Download the official binary:

```bash
wget https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz
tar -xf node-v22.20.0-linux-x64.tar.xz
NODE_BINARY=./node-v22.20.0-linux-x64/bin/node npm run build:sea
```

### Native Module Not Found

Ensure `index.node` is installed next to the executable:

```bash
install -Dm755 node_modules/@gtkx/native/dist/index.node /app/bin/index.node
```

### App Crashes on Startup

Check that:

1. GTK4 is available in the runtime (use `org.gnome.Platform`)
2. Display permissions are granted (`--socket=wayland`, `--socket=fallback-x11`)
3. IPC is shared (`--share=ipc`)

Debug with:

```bash
flatpak run --command=bash org.example.myapp
./myapp
```

## Example Project

See the complete example in the GTKX repository:

```
examples/flatpak/
```

This includes all the files described in this guide with a working counter app demo.

## Next Steps

- [Portals](./portals) — Use desktop portals for file dialogs and notifications
- [Styling](./styling) — Add custom styles to your app
- [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/) — Design your app for GNOME
