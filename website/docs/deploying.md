---
sidebar_position: 9
---

# Deploying

GTKX apps can be packaged for distribution using [Node.js Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html). This guide covers packaging as [Flatpak](https://docs.flatpak.org/) and [Snap](https://snapcraft.io/docs). A complete working example is available at `examples/deploying/` in the GTKX repository.

## Native Module Loader

The main challenge when bundling GTKX apps is that `@gtkx/native` contains a native `.node` module that cannot be embedded into a Node.js SEA blob. The solution is to:

1. Replace `@gtkx/native` imports with a loader that finds the native module at runtime
2. Copy `index.node` alongside the executable when packaging

When bundling with esbuild, use this plugin to handle `@gtkx/native`:

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

The loader detects whether it's running inside a SEA and loads `index.node` from either:

- Next to the executable (SEA mode)
- The normal `node_modules` path (development mode)

## Building the SEA

Both Flatpak and Snap packaging start with building a SEA:

1. Compile TypeScript
2. Bundle with esbuild using the native loader plugin
3. Generate the SEA blob with `node --experimental-sea-config`
4. Copy the Node.js binary and inject the blob with `postject`
5. Copy `index.node` alongside the executable

The example includes `scripts/build-sea.sh` which automates these steps.

## Flatpak

### Prerequisites

Install Flatpak, flatpak-builder, and the GNOME SDK:

```bash
flatpak install flathub org.gnome.Platform//48 org.gnome.Sdk//48
flatpak install flathub org.freedesktop.Sdk.Extension.node22//24.08
```

### Building

```bash
pnpm build:flatpak
```

This builds the SEA locally, then packages it into a Flatpak using `flatpak-builder`.

### Running

```bash
flatpak run org.gtkx.flatpak
```

### Manifest Structure

The Flatpak manifest (`flatpak/org.gtkx.flatpak.yaml`) uses pre-built binaries:

- Uses `org.gnome.Platform//48` runtime for GTK4
- Installs the SEA executable and `index.node` to `/app/bin/`
- Sets `strip: false` to preserve the SEA blob integrity

## Snap

### Prerequisites

Install snapcraft:

```bash
sudo snap install snapcraft --classic
```

### Building

```bash
pnpm build:snap
```

This builds the SEA locally, then packages it into a Snap using `snapcraft`.

### Installing and Running

```bash
sudo snap install --devmode dist/snap/gtkx-demo_0.1_amd64.snap
gtkx-snap.gtkx-demo
```

### Manifest Structure

The Snap manifest (`snap/snapcraft.yaml`) uses the `gnome` extension for GTK4 support:

- Uses `core24` base with `gnome` extension
- Copies the pre-built SEA executable and `index.node` to the snap
- Uses `devmode` confinement for development

## Complete Example

See `examples/deploying/` in the GTKX repository for a complete working example with:

- esbuild bundle script with the native loader plugin
- SEA build script with automatic Node.js binary handling
- Flatpak manifest and build script
- Snap manifest and build script

## References

- [Flatpak Documentation](https://docs.flatpak.org/)
- [Snapcraft Documentation](https://snapcraft.io/docs)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
