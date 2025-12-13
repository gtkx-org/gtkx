---
sidebar_position: 8
---

# Deploying

Deploy your GTKX app as a Flatpak for distribution on Flathub.

## Overview

Flatpak is the standard way to distribute desktop applications on Linux. This guide shows how to package a GTKX app using Node.js Single Executable Applications (SEA) within a Flatpak sandbox.

The packaging strategy:

1. **Bundle** TypeScript/JavaScript into a single file with esbuild
2. **Create SEA** by embedding the bundle into a Node.js binary
3. **Package as Flatpak** with the GNOME runtime providing GTK4

## Prerequisites

Install the Flatpak SDK and GNOME runtime:

```bash
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
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
│   └── bundle.ts          # esbuild bundler with SEA support
├── org.example.myapp.json # Flatpak manifest
├── sea-config.json        # Node.js SEA configuration
├── package.json
└── tsconfig.json
```

## Step 1: Configure SEA

Create `sea-config.json`:

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
    "finish-args": ["--share=ipc", "--socket=fallback-x11", "--socket=wayland", "--device=dri"],
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
                    "skip": [".flatpak-builder", "build-dir", "dist", "node_modules"]
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
pnpm build:flatpak
```

Run your app:

```bash
flatpak run org.example.myapp
```

## Example Project

See the complete example in the GTKX repository:

```
examples/flatpak/
```

