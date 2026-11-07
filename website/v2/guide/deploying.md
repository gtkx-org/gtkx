---
description: "Package a GTKX application as a Flatpak, Debian package, RPM, or AppImage."
---

# Deploying

`gtkx deploy` builds your application and packages it for Linux. GTKX generates the launcher, desktop entry,
AppStream metadata, and package manifests from `gtkx.config.ts`. Start with one package for your own
distribution, then add other targets or a [source Flatpak build](#publishing-on-flathub).

## Configure your application

GTKX reads the application's name, summary, version, developer, license, and homepage from the `name`,
`description`, `version`, `author`, `license`, and `homepage` fields of `package.json`, unless `deploy` sets them:

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

Theme directories are copied in full. Keep icons imported with [`?icon`](/v2/guide/assets#icons) elsewhere,
since the app bundles them itself. Keep development icons in a separate directory and select it with a
[`$development` override](/v2/guide/configuration-and-codegen#every-option).

## Choose a target

| Target     | Package                                | Use                                          |
| ---------- | -------------------------------------- | -------------------------------------------- |
| `flatpak`  | `.flatpak` bundle and local repository | A sandboxed application with a GNOME runtime |
| `deb`      | `.deb`                                 | Debian, Ubuntu, and derivatives              |
| `rpm`      | `.rpm`                                 | Fedora and other RPM distributions           |
| `appimage` | `.AppImage`                            | A downloadable executable file               |

Flatpak is the default. Set `deploy.targets` for the project's usual formats, or override them for one run:

```bash
gtkx deploy --target deb,rpm
```

Packages are written to `build/out`. Manifests and staged files are under `build/<arch>/`. `deploy.outDir: "packages"`
or `gtkx deploy --out packages` changes this deployment directory to `packages`, with finished artifacts in `packages/out`.

### Build tools

Every deployment needs `desktop-file-validate` and `appstreamcli`. Downloaded archives need `tar`;
applications with translation catalogs also need GNU gettext. See [Internationalization](/v2/guide/internationalization)
for the catalog workflow.

Flatpak needs `flatpak` and either `flatpak-builder` or the `org.flatpak.Builder` Flatpak. AppImage needs
`file`. GTKX downloads and verifies `nfpm` for Debian/RPM packaging and `appimagetool` for AppImage packaging.
The command reports missing tools with installation hints.

To use a local nFPM installation, set `deploy.tools.nfpm` to an executable name such as `"nfpm"` or a path such as `"./tools/nfpm"`. Relative paths start at the project root. This skips the pinned nFPM download for Debian and RPM packages.

## Preview and build

From a scaffolded project on Fedora, preview an RPM:

```bash
npm run deploy -- --target rpm --print-manifests
```

With pnpm, run `pnpm run deploy --target rpm --print-manifests`; `pnpm deploy` is pnpm's built-in command and does not run the script.

Use `--target deb` on Debian or Ubuntu. The preview builds and stages the application, writes the generated
metadata to `build/<arch>/metadata/` and the package manifests to `build/<arch>/targets/`, and stops before
creating packages. It skips Node.js and packaging-tool downloads; cross-architecture addon downloads and source
Flatpak dependency preparation may still need network access.

GTKX validates the desktop entry and AppStream metadata. AppStream errors and unsupported tags fail every
target. Other AppStream warnings are fatal when source-mode Flatpak is selected, including previews.
Prebuilt Flatpak, Debian, RPM, and AppImage deployments report them and continue.

Remove `--print-manifests` to build the package:

```bash
npm run deploy -- --target rpm
```

The finished package is under `build/out`. Install it on a compatible system and open the application from
the desktop launcher to check the packaged build. Even `--help` needs a display, so run command-line smoke tests
in a desktop session or a virtual display; see [Command-line apps](/v2/guide/application-lifecycle#command-line-apps). To package an existing production build:

```bash
gtkx build
gtkx deploy --skip-build
```

`--skip-build` always reads `dist/`, regardless of the deployment's `--out` directory. Keep
`dist/gtkx-schemas.json` beside the bundle: it records the build's entry, configuration, imported schemas, and
dependency notices. Deployment rejects a build of another entry, such as a helper built without `--out`, a
different production configuration, or an older metadata format; rebuild to update it. Changes to the `deploy`
block alone do not need a rebuild.

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
RPM packages also require the shared library of every other library in `libraries`, such as
`libgtksourceview-5.so.0()(64bit)` for `GtkSource-5`, which RPM resolves to the right package on any distribution.
Debian has no such relation: list the packages that ship those libraries in `deploy.depends.deb`, for example
`["libgtksourceview-5-0"]`, or the package installs on a system without them and the app fails to start. While
`deploy.depends.deb` is empty, a deb deployment warns and names the shared libraries it must cover. Declare other
system packages through `deploy.depends` as well.

The opening example sets the GTKX baseline in `deploy.minimumLibraryVersions`. GTKX writes these minimums into
Debian and RPM package dependencies but does not infer them from your code, so raise them when your app uses newer
APIs, for example `{ "Gtk-4.0": "4.22", "Adw-1": "1.8" }`. Publish the same requirements alongside an AppImage, and
check prebuilt Flatpaks against the selected GNOME runtime.

### Settings schemas

Debian, RPM, and Flatpak packages install the application's GSettings schemas into `share/glib-2.0/schemas`
under their prefix, where the system compiles them: the distribution's GLib package on installation, or
`glib-compile-schemas` in the Flatpak build. Vendor `.gschema.override` files placed there by a distribution or
administrator change the application's defaults, as they do for other GNOME applications. Every schema shares that
directory, so each schema file name must start with the application ID.

The AppImage and `node dist/bundle.mjs` read the `gschemas.compiled` that `gtkx build` writes beside the bundle,
so vendor overrides do not apply to them.

### Additional native addons

Import a prebuilt `.node` file with `?url` so GTKX includes it in the package:

```ts
import { createRequire } from "node:module";
import addonPath from "../vendor/addon.node?url";

const require = createRequire(import.meta.url);
const addon = require(addonPath) as { open(path: string): unknown };
```

Choose a prebuild matching the deployment architecture and Node.js ABI. Import the `.node` file itself, not
the package that loads it: `gtkx build` cannot bundle a package whose entry point requires its `.node` file
and stops with an error naming that package, and a loader that searches its original `node_modules` directory will not find that directory after bundling.
GTKX's own addon uses the emitted asset path in the same way. For prebuilds published as one package per
platform, such as `@node-rs/xxhash-linux-x64-gnu`, add that package as a dependency and import its `.node` file.

Every package of one deployment contains the same build. When `deploy.architectures` or `--arch` selects more
than one architecture, import a prebuild for each and load the one matching `process.arch`; GTKX does not check
the architecture of imported addons.

```ts
import { createRequire } from "node:module";
import arm64Addon from "@node-rs/xxhash-linux-arm64-gnu/xxhash.linux-arm64-gnu.node?url";
import x64Addon from "@node-rs/xxhash-linux-x64-gnu/xxhash.linux-x64-gnu.node?url";

const require = createRequire(import.meta.url);
const addon = require(process.arch === "arm64" ? arm64Addon : x64Addon) as { xxh64(input: string): bigint };
```

Package managers treat a prebuild package for another CPU differently. pnpm installs it. Yarn skips it unless
`supportedArchitectures` in `.yarnrc.yml` lists that CPU. npm rejects it with `EBADPLATFORM`, also when a
[source Flatpak](#publishing-on-flathub) runs `npm ci` on another architecture, so npm projects copy each
prebuild into the project and import it by path, as in the first example.

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
file modes. A directory source installs every file below it, so a directory of man pages or a whole build output
takes one entry. Generated desktop, AppStream, and MIME metadata take precedence over extra files targeting the
same destination.

### Desktop actions

`deploy.desktopActions` adds entries to the application's launcher menu. Choosing one runs the application with
the entry's `args`:

```ts
deploy: {
    isDbusActivatable: true,
    desktopActions: { today: { name: "Today", args: ["tasks://today"] } },
},
```

With `isDbusActivatable: true`, launchers ignore `args`. They start the application if needed and activate its
`app.<id>` action, so register an application action under each ID. An action launch does not emit `activate`,
so the windows render only after the handler calls `activate()`:

```tsx
import type * as Adw from "@gtkx/gi/adw";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useRef, useState } from "react";
import { MainWindow } from "./main-window.js";

export const App = () => {
    const application = useRef<Adw.Application | null>(null);
    const [view, setView] = useState("inbox");

    const showToday = () => {
        setView("today");
        application.current?.activate();
    };

    return (
        <AdwApplication ref={application} actions={<GSimpleAction name="today" onActivate={showToday} />}>
            <MainWindow view={view} />
        </AdwApplication>
    );
};
```

### Helper commands

An application can ship a command-line helper beside it, such as a `tally-report` command that prints the
application's data without opening a window. Build the helper into its own directory, as in
[Production build output](/v2/guide/assets#production-build-output), before every deployment, since
`gtkx deploy` rebuilds only `dist/`:

```bash
gtkx build src/report.ts --out dist-report
gtkx deploy
```

List the whole directory in `extraFiles`, so chunk names that change between helper builds need no
configuration change, along with a launcher script and the helper's dependency notices:

```ts
deploy: {
    extraFiles: {
        "lib/tally-report": "dist-report",
        "bin/tally-report": { source: "packaging/tally-report", mode: "0755" },
        "share/licenses/tally/tally-report-NOTICES": "dist-report/BUNDLED-NOTICES",
    },
},
```

The launcher runs the helper with the bundled Node.js runtime. Every target installs it at
`lib/<binaryName>/node` below the installation prefix, `lib/tally/node` for an application whose binary name is
`tally`, so launcher scripts can rely on that path:

```sh
#!/bin/sh
set -e
self=$(readlink -f "$0")
prefix=$(dirname "$(dirname "$self")")
exec "$prefix/lib/tally/node" "$prefix/lib/tally-report/bundle.mjs" "$@"
```

Debian, RPM, AppImage, and prebuilt Flatpak packages then contain the helper. Inside the Flatpak sandbox, run
it with `flatpak run --command=tally-report <application ID>`. GTKX does not merge the helper's notices into the
application's, and a [source Flatpak](#publishing-on-flathub) builds only the application from your repository,
so building and installing the helper there is up to you.

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

Source mode needs a standalone project, with its lockfile and `packageManager` field in the application's
directory. An app in a [workspace](/v2/guide/workspaces#monorepos) shares the lockfile and package
manager of the workspace root, so `gtkx deploy` stops with an error, including previews, when a workspace member
selects source mode. Package a workspace member as a prebuilt Flatpak, or move it into its own repository to
publish it from source.

Install [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/blob/master/node/README.md)
for dependency preparation, including previews. GTKX detects npm, pnpm, or yarn from the lockfile. A pnpm
project needs a generator with `--pnpm-store-version`. Explicit pnpm pins support major versions 10, 11
(11.3.0 or later), and 12. The `packageManager` field must include an integrity digest. For pnpm 12, which
runs as a native binary, the manifest also vendors that binary for each architecture, with checksums read from
the npm registry when the manifest is generated.

A Yarn 2 or later project, recognized by its `yarn.lock` format, installs with the release its `packageManager`
field names instead of the SDK's Yarn 1, so that field is required. The manifest vendors that release, checked
against the field's sha512 digest when it carries one, as `corepack use yarn@<version>` writes it, or against the
checksum the npm registry publishes for `@yarnpkg/cli-dist` otherwise. The offline install follows
flatpak-node-generator's recipe for these lockfiles: its Yarn plugin turns the vendored package tarballs into
Yarn's cache before `yarn install --immutable`.

Keep the generated Flatpak manifest and `generated-sources.json` together, and regenerate them after dependency
changes. When the pinned commit is in the local checkout, `generated-sources.json` comes from the lockfile
committed there, so commit dependency changes before regenerating. Deployment stops with an error, including
previews, when that commit has no lockfile.

Source mode rebuilds the application bundle; native npm dependencies still use their packaged binaries.
Review those dependencies against [Flathub's source-build requirements](https://docs.flathub.org/docs/for-app-authors/requirements#building-from-source)
and test the final manifest before submission. A successful preview does not validate the source build or
confirm compliance with Flathub requirements. The [Flatpak tutorial](/v2/tutorial/flatpak) walks through the GTKX workflow.

## Flatpak in containers

If Flatpak stops while spawning `rofiles-fuse`, set `deploy.flatpak.shouldUseRofilesFuse: false` in `gtkx.config.ts` and retry. This applies to both prebuilt and source builds when the container cannot provide FUSE.

If a failed deployment leaves an output directory that GTKX refuses to replace, keep it for diagnosis and choose a fresh directory, for example `npm run deploy -- --target flatpak --out build-flatpak-retry`.
