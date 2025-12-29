# Deploying

This guide covers packaging and distributing your GTKX application.

## Overview

GTKX apps are Node.js applications with native GTK4 bindings. To distribute them:

1. **Bundle** the JavaScript code with esbuild
2. **Create a SEA** (Single Executable Application) using Node.js
3. **Package** with Flatpak or Snap for distribution

## Single Executable Application (SEA)

The native module (`@gtkx/native`) must be handled specially since it cannot be bundled into JavaScript.

### Bundle with esbuild

Mark the native module as external:

```typescript
// scripts/bundle.ts
import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["dist/index.js"],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile: "dist/bundle.js",
    format: "cjs",
    external: ["./index.node"], // Keep native module external
});
```

### SEA Configuration

Create `sea-config.json`:

```json
{
    "main": "dist/bundle.js",
    "output": "dist/sea-prep.blob",
    "disableExperimentalSEAWarning": true,
    "useSnapshot": false,
    "useCodeCache": true
}
```

### Build the SEA

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

# Copy native module alongside the binary
cp node_modules/@gtkx/native/index.node dist/

echo "SEA built successfully"
```

The final distribution includes two files:

- `dist/app` — The executable with your bundled JavaScript (~100MB)
- `dist/index.node` — The native GTK4 bindings

## Flatpak Packaging

Flatpak is the recommended distribution format for Linux desktop applications.

### Prerequisites

```bash
# Install flatpak-builder
sudo dnf install flatpak-builder  # Fedora
sudo apt install flatpak-builder  # Ubuntu/Debian

# Install required SDKs
flatpak install flathub org.gnome.Sdk//48
flatpak install flathub org.freedesktop.Sdk.Extension.node22//24.08
```

### Flatpak Manifest

Create `flatpak/com.example.myapp.yaml`:

```yaml
app-id: com.example.myapp
runtime: org.gnome.Platform
runtime-version: "48"
sdk: org.gnome.Sdk
sdk-extensions:
    - org.freedesktop.Sdk.Extension.node22
command: myapp

finish-args:
    - --share=ipc
    - --socket=fallback-x11
    - --socket=wayland
    - --device=dri

build-options:
    append-path: /usr/lib/sdk/node22/bin

modules:
    - name: myapp
      buildsystem: simple
      build-commands:
          - install -Dm755 app /app/bin/myapp
          - install -Dm755 index.node /app/bin/index.node
      sources:
          - type: file
            path: ../dist/app
          - type: file
            path: ../dist/index.node
```

### Desktop Entry

Create `flatpak/com.example.myapp.desktop`:

```ini
[Desktop Entry]
Name=My App
Comment=A GTKX application
Exec=myapp
Icon=com.example.myapp
Terminal=false
Type=Application
Categories=Utility;
```

### Build and Install

```bash
# Build the Flatpak
flatpak-builder --force-clean build-dir flatpak/com.example.myapp.yaml

# Create distributable bundle
flatpak build-bundle ~/.local/share/flatpak/repo \
    dist/com.example.myapp.flatpak com.example.myapp

# Install locally
flatpak install --user dist/com.example.myapp.flatpak

# Run
flatpak run com.example.myapp
```

## Snap Packaging

Snap is an alternative packaging format, popular on Ubuntu.

### Prerequisites

```bash
sudo snap install snapcraft --classic
sudo snap install lxd && sudo lxd init --auto
```

### Snap Configuration

Create `snap/snapcraft.yaml`:

```yaml
name: myapp
version: "1.0.0"
summary: A GTKX application
description: |
    My application built with GTKX.

base: core24
grade: stable
confinement: strict

apps:
    myapp:
        command: bin/myapp
        extensions: [gnome]
        plugs:
            - home
            - network

parts:
    myapp:
        plugin: dump
        source: dist/
        organize:
            app: bin/myapp
            index.node: bin/index.node
```

### Build and Install

```bash
# Build the Snap
snapcraft --use-lxd

# Install (development mode)
sudo snap install --devmode myapp_*.snap

# Run
myapp
```

## Troubleshooting

### App crashes on startup

Ensure the native module (`index.node`) is in the same directory as the executable.

### Missing GTK4 libraries

- **Flatpak:** Ensure you're using the GNOME runtime (`org.gnome.Platform`)
- **Snap:** Ensure you're using the `gnome` extension

### Flatpak build fails with permission errors

Make sure you have the required SDKs installed:

```bash
flatpak install flathub org.gnome.Sdk//48
flatpak install flathub org.freedesktop.Sdk.Extension.node22//24.08
```

### Snap build fails

Try building in a clean LXD container:

```bash
snapcraft --use-lxd
```

## Distribution

### Flathub

To publish on Flathub, submit your manifest to https://github.com/flathub/flathub

### Snap Store

To publish on the Snap Store:

```bash
snapcraft login
snapcraft upload --release=edge myapp_*.snap
```

## Complete Example

For a fully working example with all configuration files, build scripts, and CI setup, see the [deploying example](https://github.com/eugeniodepalo/gtkx/tree/main/examples/deploying) in the repository.

## Resources

- [Flatpak Documentation](https://docs.flatpak.org/)
- [Snapcraft Documentation](https://snapcraft.io/docs)
- [Node.js SEA Documentation](https://nodejs.org/api/single-executable-applications.html)
