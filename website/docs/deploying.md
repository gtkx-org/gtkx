# Deploying

GTKX apps are Node.js applications with native GTK4 bindings. Distribution requires:

1. **Bundle** the JavaScript code with esbuild
2. **Create a SEA** (Single Executable Application) using Node.js
3. **Package** with Flatpak or Snap

## Single Executable Application (SEA)

The native module (`@gtkx/native`) cannot be bundled into JavaScript and must be distributed alongside the executable.

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

# Copy native module alongside the binary
cp node_modules/@gtkx/native/index.node dist/
```

The final distribution includes:
- `dist/app` — The executable (~100MB)
- `dist/index.node` — The native GTK4 bindings

## Flatpak Packaging

Flatpak is the recommended format for Linux desktop applications. The key GTKX-specific requirement is including the native module:

```yaml
# flatpak/com.example.myapp.yaml
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

modules:
 - name: myapp
 buildsystem: simple
 build-commands:
 - install -Dm755 app /app/bin/myapp
 - install -Dm755 index.node /app/bin/index.node # GTKX native module
 sources:
 - type: file
 path: ../dist/app
 - type: file
 path: ../dist/index.node
```

For complete Flatpak setup (prerequisites, desktop entry, build commands), see the [Flatpak Documentation](https://docs.flatpak.org/) and the [deploying example](https://github.com/eugeniodepalo/gtkx/tree/main/examples/deploying).

## Snap Packaging

Snap is an alternative format, popular on Ubuntu. The key GTKX-specific requirement:

```yaml
# snap/snapcraft.yaml
name: myapp
version: "1.0.0"
base: core24
confinement: strict

apps:
 myapp:
 command: bin/myapp
 extensions: [gnome] # Required for GTK4

parts:
 myapp:
 plugin: dump
 source: dist/
 organize:
 app: bin/myapp
 index.node: bin/index.node # GTKX native module
```

For complete Snap setup, see the [Snapcraft Documentation](https://snapcraft.io/docs).

## Troubleshooting

### App crashes on startup

Ensure `index.node` is in the same directory as the executable.

### Missing GTK4 libraries

- **Flatpak:** Use `org.gnome.Platform` runtime
- **Snap:** Use the `gnome` extension

## Complete Example

For a fully working example with all configuration files, build scripts, and CI setup, see the [deploying example](https://github.com/eugeniodepalo/gtkx/tree/main/examples/deploying).
