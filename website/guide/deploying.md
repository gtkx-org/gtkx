---
description: "Package a GTKX app as a Flatpak, Debian package, RPM, or AppImage."
---

# Deploying

`gtkx deploy` builds a GTKX application and packages it for Linux. GTKX generates the launcher, desktop entry, AppStream metadata, and package manifests from `gtkx.config.ts`.

## Configure the application

Keep the version, author, license, and homepage in `package.json`. GTKX uses those values unless the `deploy` block overrides them:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.example.Tasks",
    applicationIcon: "data/icons",
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office"],
        minimumLibraryVersions: { "Gtk-4.0": "4.20", "Adw-1": "1.8" },
    },
});
```

Without a `deploy` block, the command stops and suggests a starter configuration. `defineConfig` provides completion, and the [`@gtkx/config` reference](/reference/@gtkx/config/) documents every option.

### Application icons

The example expects an icon such as `data/icons/hicolor/scalable/apps/com.example.Tasks.svg`. An icon-theme directory must contain an application icon named after `applicationId` under `hicolor/<size>/apps`; GTKX preserves its other sizes and variants.

You can also point `applicationIcon` at one SVG, PNG, or XPM file. When the option is omitted, GTKX looks for exactly one file named after the application ID in the project root. Deployment requires an icon.

Keep development icons in a separate directory and select them with a [`$development` override](/guide/configuration-and-codegen#every-option), so they cannot enter a production package.

## Choose a target

| Target | Package | Use |
| --- | --- | --- |
| `flatpak` | `.flatpak` bundle and local repository | A sandboxed application with a GNOME runtime |
| `deb` | `.deb` | Debian, Ubuntu, and derivatives |
| `rpm` | `.rpm` | Fedora and other RPM distributions |
| `appimage` | `.AppImage` | A downloadable executable file |

Set `deploy.targets` for the project's usual formats, or override them for one run:

```bash
gtkx deploy --target deb,rpm
```

With neither setting, GTKX builds a Flatpak. Finished packages land in `build/out/`; generated metadata and manifests remain under `build/` for review.

## Preview and build

From a scaffolded project on Fedora, preview an RPM:

```bash
npm run deploy -- --target rpm --print-manifests
```

Use `--target deb` on Debian or Ubuntu. Review the generated files before creating packages.

GTKX builds and stages the application, validates its desktop entry and AppStream metadata, then stops before packaging. Remove `--print-manifests` to produce the package:

```bash
npm run deploy -- --target rpm
```

Install it on a compatible system and open it from the desktop launcher to check the packaged build.

To package an existing production build:

```bash
gtkx build
gtkx deploy --skip-build
```

Keep the complete `dist/` directory together. It contains the bundle, native addon, compiled settings, and the build metadata used to reproduce dependency notices. `--out` changes the deployment directory, which defaults to `build`.

Every deployment needs `desktop-file-validate` and `appstreamcli`. Translation catalogs need GNU gettext, Flatpak needs its builder, and AppImage needs `file`. GTKX downloads and verifies the packaging tools for Debian, RPM, and AppImage. When a local tool is missing, the command reports the appropriate installation command.

## Runtime requirements

GTKX 1.6 requires Node.js 24 or newer, while supported distributions may ship an older release. Prebuilt packages bundle the version used for deployment. The default downloads the official archive, verifies it, and caches it. The host and path modes use a local runtime after checking that it is suitable for the package; see the [configuration reference](/reference/@gtkx/config/) for those settings.

GTK, libadwaita, and other native libraries come from the host system or Flatpak runtime. Generated GTKX bindings call them directly, so installed applications do not need GIR files. Declare additional system packages and minimum library versions in `deploy` when the application uses them. The opening example records the GTKX baseline in `minimumLibraryVersions`; raise it when using newer APIs. GTKX writes those minimums into Debian and RPM dependencies but does not infer the minimum API version from your code. AppImage users still need compatible system libraries.

## Third-party notices

Every package includes license notices for Node.js, GTKX, and the JavaScript dependencies reached by the application bundle. It also identifies native libraries supplied by the host or runtime. Missing dependency license data produces a warning for the application author to resolve.

Debian installs the notices in its machine-readable copyright file. The other targets install `THIRD-PARTY-NOTICES` beside the application's license. Rebuild after changing dependencies so these files describe the packaged bundle.

## Customize a package

Keep packaging adjustments in `deploy`. Flatpak permissions, extra files, system dependencies, maintainer scripts, and signing all belong there. Use `defineConfig` completion and the [configuration reference](/reference/@gtkx/config/) for their exact shapes.

Flatpak defaults permit display access and hardware rendering. Add network or filesystem access only when the application needs it; use the [Flatpak permission documentation](https://docs.flatpak.org/en/latest/sandbox-permissions.html) to choose `deploy.flatpak.finishArgs`.

## Publish on Flathub

The default Flatpak mode packages the local build. Source mode generates a manifest that checks out a pinned Git revision, installs dependencies offline, and runs `gtkx build` inside the GNOME SDK:

```ts
flatpak: {
    mode: "source",
    source: { url: "https://github.com/you/tasks.git", tag: "v1.0.0" },
},
```

Put this inside `deploy` and use the application's public repository and release tag. Commit every source, lockfile, icon, license, catalog, and extra file that the package installs.

Install [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node) before preparing a source manifest. Keep its generated dependency file beside the Flatpak manifest and regenerate both after dependency changes.

Source mode rebuilds the application bundle, while native npm dependencies still use their packaged binaries. Review those dependencies against [Flathub's source-build requirements](https://docs.flathub.org/docs/for-app-authors/requirements#building-from-source) and test the final manifest before submission. [Shipping It on Flathub](/tutorial/flatpak) walks through the GTKX workflow.

## Flatpak in containers

If Flatpak stops while spawning `rofiles-fuse`, set `deploy.flatpak.shouldUseRofilesFuse: false` in `gtkx.config.ts` and retry. This applies to both prebuilt and source builds when the container cannot provide FUSE.

## Next

The [API reference](/reference/) documents GTKX's public TypeScript APIs.
