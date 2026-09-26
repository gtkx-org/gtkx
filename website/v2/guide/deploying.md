---
description: "Package a GTKX application as a Flatpak, Debian package, RPM, or AppImage."
---

# Deploying

`gtkx deploy` builds your application and packages it for Linux. GTKX generates the launcher, desktop entry,
AppStream metadata, and package manifests from `gtkx.config.ts`. Start with one package for your own
distribution, then add other targets or a [source Flatpak build](#publishing-on-flathub).

## Configure your application

Keep the application's version, author, and license in `package.json`. GTKX uses those values unless you
override them in `deploy`:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    applicationIcon: "data/icons",
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office"],
        minimumLibraryVersions: { "Gtk-4.0": "4.20", "Adw-1": "1.8" },
    },
});
```

Without a `deploy` block, the command stops and suggests a starter configuration. `defineConfig` provides
completion for packaging settings; the [configuration API reference](/v2/reference/@gtkx/config/) describes
its exported types.

### Application icons

The example expects an icon such as `data/icons/hicolor/scalable/apps/com.example.Tasks.svg`. A theme
directory must contain an application icon named after `applicationId` under `hicolor/<size>/apps`.
GTKX preserves the directory's other sizes and variants.

You can also point `applicationIcon` at a single SVG, PNG, or XPM file. When the option is omitted, GTKX looks
for exactly one `<applicationId>.svg`, `.png`, or `.xpm` in the project root. Deployment requires an icon.

Theme directories are copied in full. Keep development icons in a separate directory and select it with a
[`$development` override](/v2/guide/configuration-and-codegen#every-option).

## Choose a target

| Target | Package | Use |
| --- | --- | --- |
| `flatpak` | `.flatpak` bundle and local repository | A sandboxed application with a GNOME runtime |
| `deb` | `.deb` | Debian, Ubuntu, and derivatives |
| `rpm` | `.rpm` | Fedora and other RPM distributions |
| `appimage` | `.AppImage` | A downloadable executable file |

Flatpak is the default. Set `deploy.targets` for the project's usual formats, or override them for one run:

```bash
gtkx deploy --target deb,rpm
```

Packages land in `build/out`. Manifests and staged files are under `build/<arch>/`. `gtkx deploy --out packages`
changes this deployment directory to `packages`, with finished artifacts in `packages/out`.

### Build tools

Every deployment needs `desktop-file-validate` and `appstreamcli`. Downloaded archives need `tar`;
applications with translation catalogs also need GNU gettext. See [Internationalization](/v2/guide/internationalization)
for the catalog workflow.

Flatpak needs `flatpak` and either `flatpak-builder` or the `org.flatpak.Builder` Flatpak. AppImage needs
`file`. GTKX downloads and verifies `nfpm` for Debian/RPM packaging and `appimagetool` for AppImage packaging.
The command reports missing tools with installation hints.

## Preview and build

From a scaffolded project on Fedora, preview an RPM:

```bash
npm run deploy -- --target rpm --print-manifests
```

Use `--target deb` on Debian or Ubuntu. The preview prints the generated metadata and manifests for review.

This still builds and stages the application, but stops before package creation. It skips Node.js and
packaging-tool downloads; cross-architecture addon downloads and source Flatpak dependency preparation may
still need network access.

GTKX validates the desktop entry and AppStream metadata. AppStream errors and unsupported tags fail every
target. Other AppStream warnings are fatal when source-mode Flatpak is selected, including previews.
Prebuilt Flatpak, Debian, RPM, and AppImage deployments report them and continue.

Remove `--print-manifests` to build the package:

```bash
npm run deploy -- --target rpm
```

The finished package is under `build/out`. Install it on a compatible system and open the application from
the desktop launcher to check the packaged build. To package an existing production build:

```bash
gtkx build
gtkx deploy --skip-build
```

`--skip-build` always reads `dist/`, regardless of the deployment's `--out` directory. Keep
`dist/gtkx-schemas.json` beside the bundle: it records the build's configuration, imported schemas, and
dependency notices. Deployment rejects a different production configuration or an older metadata format;
rebuild to update it.

Each deployment replaces its managed output directory. Choose an empty directory or an earlier GTKX deploy
directory below the project root, outside `dist/`; symlinked output paths and unrelated files are rejected.

### Architectures

Deployment uses the host architecture unless `deploy.architectures` or `--arch` selects `x64`, `arm64`, or both:

```bash
gtkx deploy --target deb,rpm --arch x64,arm64
```

Only Debian and RPM packages support cross-building. Flatpak and AppImage must be built on their target
architecture. Cross-building also requires the default `deploy.node.source: "download"`; GTKX obtains the
matching Node.js runtime and native addon.

## Runtime and library requirements

For prebuilt deployments, GTKX bundles Node.js with the application. The default download is pinned to
26.8.2, verified, and cached. Use `deploy.node.version` to choose another supported version. The `host` and `path` sources use an existing
runtime; GTKX checks its version and portability. See [DeployNodeOptions](/v2/reference/@gtkx/config/index/type-aliases/DeployNodeOptions).

GTK, libadwaita, and other native libraries come from the host system or the Flatpak runtime. Generated GTKX
bindings call those libraries directly; the installed app does not need GIR files. An AppImage still needs
compatible native libraries on the host.

Debian and RPM dependencies include GTK, libadwaita, and runtime requirements detected from staged binaries.
Declare additional system packages through `deploy.depends`. The opening example explicitly sets the GTKX
baseline in `deploy.minimumLibraryVersions`; raise it when your app uses newer APIs, for example
`{ "Gtk-4.0": "4.22", "Adw-1": "1.8" }`. GTKX writes these minimums into Debian and RPM package dependencies;
it does not infer the minimum API version from your code. Publish the same requirements alongside an
AppImage, and check prebuilt Flatpaks against the selected GNOME runtime.

### Additional native addons

Import a prebuilt `.node` file with `?url` so GTKX includes it in the package:

```ts
import { createRequire } from "node:module";
import addonPath from "../vendor/addon.node?url";

const require = createRequire(import.meta.url);
const addon = require(addonPath) as { open(path: string): unknown };
```

Choose a prebuild matching the deployment architecture and Node.js ABI. A package loader that searches its
original `node_modules` directory will not find that directory after bundling. GTKX's own addon uses the
emitted asset path in the same way.

## Third-party notices

Packages contain the application bundle, Node.js, GTKX's native addon, and the imported resources, schemas,
fonts, and translations. GTKX also installs desktop integration files and license notices; applications do
not need an installed `node_modules` tree.

The notices cover bundled Node.js, GTKX, and bundled JavaScript dependencies, and identify the platform
libraries used by the application. `gtkx build` records dependency names, versions, source links, and license
terms, so replacing or removing an installed dependency does not change the notices for an existing bundle.
Dependencies with neither a license declaration nor license text remain listed with a warning.

Debian packages install the notices at `/usr/share/doc/<binaryName>/copyright`. Other targets use
`share/licenses/<binaryName>/THIRD-PARTY-NOTICES` under their installation prefix: `/app` for Flatpak,
`/usr` for RPM, and the AppImage's embedded `usr` directory.

## Customize a package

Keep packaging adjustments in `deploy`. For example, `flatpak.finishArgs` configures sandbox permissions,
`extraFiles` includes additional files, and `metainfoExtra` adds uncommon AppStream metadata before validation.
Signing and format-specific settings also live here; use `defineConfig` completion to explore them.

Flatpak defaults permit display access and hardware rendering. Add network or filesystem access only when
your application needs it; use the [Flatpak permission documentation](https://docs.flatpak.org/en/latest/sandbox-permissions.html)
to choose the arguments for `deploy.flatpak.finishArgs`.

Extra files must exist before deployment starts. Their destinations are relative to the installation prefix;
see [DeployExtraFileOptions](/v2/reference/@gtkx/config/index/type-aliases/DeployExtraFileOptions) for explicit
file modes. Generated desktop, AppStream, and MIME metadata take precedence over extra files targeting the
same destination.

## Source Flatpak builds {#publishing-on-flathub}

The default Flatpak mode packages the local build. Set `deploy.flatpak.mode` to `"source"` to generate a
manifest that checks out a pinned Git revision, installs dependencies offline, and runs `gtkx build` inside
the GNOME SDK:

```ts
flatpak: {
    mode: "source",
    source: { url: "https://github.com/you/tasks.git", tag: "v1.0.0" },
},
```

Put this inside `deploy` and use your application's public repository and release tag. Commit the sources,
lockfile, icons, license, translation catalogs, and extra files that the manifest installs. Those files must
be available inside the project checkout. Without an explicit tag or commit, GTKX pins the current checkout
commit. Source builds use Node.js from the SDK extension.

Install [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/blob/master/node/README.md)
for dependency preparation, including previews. GTKX detects npm, pnpm, or yarn from the lockfile. A pnpm
project needs a generator with `--pnpm-store-version`. Explicit pnpm pins support major versions 10, 11
(11.3.0 or later), and 12. The `packageManager` field must include an integrity digest.

Keep the generated Flatpak manifest and `generated-sources.json` together, and regenerate them after dependency
changes.

Source mode rebuilds the application bundle; native npm dependencies still use their packaged binaries.
Review those dependencies against [Flathub's source-build requirements](https://docs.flathub.org/docs/for-app-authors/requirements#building-from-source)
and test the final manifest before submission. A successful preview does not validate that build or establish
Flathub readiness. The [Flatpak tutorial](/v2/tutorial/flatpak) walks through the GTKX workflow.

## Flatpak in containers

If Flatpak stops while spawning `rofiles-fuse`, set `deploy.flatpak.shouldUseRofilesFuse: false` in `gtkx.config.ts` and retry. This applies to both prebuilt and source builds when the container cannot provide FUSE.

If a failed deployment leaves an output directory that GTKX refuses to replace, keep it for diagnosis and choose a fresh directory, for example `npm run deploy -- --target flatpak --out build-flatpak-retry`. The `--out` directory must be below the project root and outside `dist/`.
