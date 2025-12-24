---
sidebar_position: 9
---

# Deploying

GTKX apps can be packaged as [Flatpaks](https://docs.flatpak.org/) using [Node.js Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html). A complete working example is available at `examples/flatpak/` in the GTKX repository.

## GTKX-Specific Consideration

The main challenge when bundling GTKX apps is that `@gtkx/native` contains a native `.node` module that cannot be embedded into a Node.js SEA blob. The solution is to:

1. Replace `@gtkx/native` imports with a loader that finds the native module at runtime
2. Copy `index.node` alongside the executable when packaging

## Native Module Loader

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

## Packaging the Native Module

When creating the Flatpak, copy `index.node` alongside the executable:

```bash
install -Dm755 node_modules/@gtkx/native/dist/index.node /app/bin/index.node
```

## Complete Example

See `examples/flatpak/` in the GTKX repository for a complete working example with:
- esbuild bundle script with the native loader plugin
- SEA configuration
- Flatpak manifest

For general Flatpak and Node.js SEA documentation, refer to:
- [Flatpak Documentation](https://docs.flatpak.org/)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
