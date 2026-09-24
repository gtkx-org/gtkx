---
description: "Package a native GNOME app built with GTKX as a Flatpak, a .deb, an .rpm, or an AppImage."
---

# Deploying

`gtkx deploy` turns a project into installable packages. Everything it needs comes from one `deploy` block in `gtkx.config.ts`, and everything derivable is derived, so a small app configures a handful of keys and never writes a desktop entry, an AppStream file, a Flatpak manifest, or a package control file by hand.

```bash
gtkx deploy
```

```
[gtkx] Deploying Tasks 1.0.0-1 as gtkx-tutorial (x86_64) to flatpak
[gtkx] Validated the desktop entry and the metainfo
[gtkx] Building ~/tasks/src/index.tsx
[gtkx] Bundled Node.js v24.19.0 (100.8 MiB, glibc >= 2.28)
[gtkx] Staged 12 files into build/stage
[gtkx] Wrote build/targets/flatpak/com.gtkx.tutorial.yml
[gtkx] flatpak: running flatpak-builder, this can take several minutes
[gtkx] Built build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak (31.2 MiB)
[gtkx] Deploy complete: 1 artifacts in build/out
```

## Supported targets

| Target | Produces | Who it is for |
| --- | --- | --- |
| `flatpak` | a `.flatpak` bundle, and a local repository to install from | Every desktop Linux user, sandboxed, with a pinned GNOME runtime |
| `deb` | `<name>_<version>-<revision>_<arch>.deb` | Debian, Ubuntu, and derivatives |
| `rpm` | `<name>-<version>-<release>.<arch>.rpm` | Fedora, RHEL, openSUSE |
| `appimage` | `<Name>-<version>-<arch>.AppImage` | A single file that runs without installing |

`deploy.targets` picks the default set, and `--target` overrides it for one run:

```bash
gtkx deploy --target deb,rpm
```

With neither, `gtkx deploy` builds a Flatpak.

## The minimum configuration

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.example.Tasks",
    applicationIcon: "data/icons",
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office"],
    },
});
```

Run `gtkx deploy` with no `deploy` block at all and it prints a starter block with every derivable value already filled in from `package.json`.

## What is derived

Anything you leave out is derived, so the same fact never lives in two places:

| Key | Comes from |
| --- | --- |
| `name` | the `package.json` name, title-cased, or the last segment of `applicationId` |
| `binaryName` | the `package.json` name, scope stripped and normalized to a package name |
| `version` | `package.json` `version` |
| `summary` | the first line of `package.json` `description` |
| `description` | the summary, when no paragraphs are given |
| `developer` | the parsed `package.json` `author` |
| `developer.id` | `applicationId` minus its last segment |
| `license` | `package.json` `license` |
| `homepage` | `package.json` `homepage` |
| `metadataLicense` | `CC0-1.0` |
| `copyright` | `Copyright © <year> <developer.name>` |
| `releases` | one entry, from the version and today's date |
| deb `section`, rpm `group` | the first entry in `categories` |
| deb `Depends`, rpm `Requires` | GTK and libadwaita when your `libraries` bind them, plus the glibc minimum read out of the built binaries. Every other dependency is yours to declare through `deploy.depends` |
| `screenshotBaseUrl` | the `origin` git remote, including the project's path inside the repository |

The application icon is the one thing that has to exist. Set the top-level `applicationIcon` option to an
icon-theme directory such as `data/icons`, or to a single image. In a directory, the primary file must be under
`hicolor/<size>/apps` and its name must match the application ID because the desktop entry names that ID as its
icon. Sizes can be `scalable`, `symbolic`, a square pixel size, or a scaled pixel size such as `128x128@2`; GTKX
preserves the whole theme tree and its variants. You can omit the option when exactly one `<applicationId>.svg`,
`.png`, or `.xpm` file is in the project root; deploying without any icon still fails.

An icon-theme directory is copied verbatim; packaging does not filter files by application ID. Keep a development-only `.Devel` icon in a separate tree and select it through the mode overlay so it cannot enter a production package:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    applicationIcon: "data/icons",
    $development: {
        applicationIcon: "data/icons-devel",
    },
});
```

## What gets installed

Every target installs the same tree, under `/usr` for deb, rpm, and AppImage, and under `/app` for Flatpak:

```
bin/<binaryName>                                 a launcher script
lib/<binaryName>/node                            the bundled Node.js
lib/<binaryName>/bundle.mjs                      the app
lib/<binaryName>/gtkx.node                       the native addon
lib/<binaryName>/gtkx.gresource                  bundled GResource assets, when present
lib/<binaryName>/gschemas.compiled               compiled settings schemas
share/applications/<id>.desktop                  generated
share/metainfo/<id>.metainfo.xml                 generated
share/icons/hicolor/**/apps/<id>.svg             copied from applicationIcon
share/glib-2.0/schemas/<id>*.gschema.xml         copied from imported schemas
share/locale/<locale>/LC_MESSAGES/<id>.mo        compiled from po/<locale>.po, when present
share/mime/packages/<id>.xml                     generated, when you declare fileAssociations
share/licenses/<binaryName>/LICENSE              your license file, on every target but deb
share/licenses/<binaryName>/THIRD-PARTY-NOTICES  generated, on every target but deb
share/doc/<binaryName>/copyright                 generated, deb only
<destination>                                    every deploy.extraFiles entry
```

`bundle.mjs`, `gtkx.node`, the optional `gtkx.gresource`, and the compiled schemas are siblings because the
built bundle resolves them all relative to itself. The launcher resolves everything from its own location, so
the same tree works at `/usr`, at `/app`, and inside an AppImage mount point.

## Why Node.js is bundled

GTKX needs Node.js 24, and Debian 13 ships 20 while Ubuntu 26.04 ships 22, so the package cannot depend on the distribution's. `gtkx deploy` downloads the official `nodejs.org` build matching the Node.js you are running and verifies it against the published SHA-256. The release archive is cached under `~/.cache/gtkx/node/` and re-verified on every reuse, so only the first deploy needs network access. That costs about 100 MiB per package.

`deploy.node.source` changes where it comes from:

- `"download"` (default) fetches and verifies the official build.
- `"host"` copies the Node.js running the build. Fully offline, but rejected with an explanation when that binary links against something the target machine will not have, which is the case for the Node.js packages Fedora and Debian ship.
- `"path"` uses `deploy.node.path`.

## Third-party notices

A package carries software its author did not write: the Node.js runtime, GTKX itself, and every npm package the bundle reaches. Every deploy generates the notices for all of it and installs them.

| Target | Where they land |
| --- | --- |
| `deb` | `share/doc/<binaryName>/copyright`, in the [machine-readable copyright format](https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/), with a `Files:` stanza per file it carries |
| `rpm`, `appimage`, `flatpak` | `share/licenses/<binaryName>/THIRD-PARTY-NOTICES`, beside your own `LICENSE` |

The notices cover Node.js, GTKX and its linked Rust crates, and the JavaScript dependencies reached by the application bundle. They also identify native libraries that the package uses from the host or Flatpak runtime. When a bundled dependency has no usable license information, GTKX keeps it in the notice and prints a warning for you to resolve.

Keep the complete `dist/` directory when using `--skip-build`, and rebuild after changing dependencies so the packaged notices match the bundle. Source-mode Flatpaks take Node.js from the SDK extension and describe that runtime in the same notice.

## Tools you need installed

`desktop-file-validate` and `appstreamcli` are always required, because they are what catch a metadata mistake before it reaches a software center. Projects with a `po/` directory also need GNU gettext: deploy uses `xgettext` to refresh the catalog template, `msggrep` to retain generated metadata during intermediate source builds, `msginit` to initialize a missing PO listed in `LINGUAS`, `msgmerge` to synchronize every existing PO, and `msgfmt` to compile catalogs and merge translations into generated metadata. Normal codegen and builds use the same tools as their catalog paths require. A `--skip-build` deploy needs only `msgfmt`: it recompiles the existing catalogs without rewriting the POT or PO files. `tar` is required whenever packages are actually built, since the bundled Node.js is extracted from its release archive. Beyond that it depends on the target:

| Target | Needs | Fetched automatically |
| --- | --- | --- |
| `flatpak` | `flatpak`, and either `flatpak-builder` or the `org.flatpak.Builder` Flatpak | the GNOME runtime |
| `flatpak` with `mode: "source"` | the above, plus `flatpak-node-generator`, supporting `--pnpm-store-version` for a pnpm project | |
| `deb`, `rpm` | | `nfpm` |
| `appimage` | `file` | `appimagetool` and the AppImage runtime |

`nfpm` and `appimagetool` are downloaded, checksum-verified, and cached under `~/.cache/gtkx/`, so building a `.deb` on Fedora and an `.rpm` on Debian both work without installing anything distribution-specific. Only the archives are cached, and each is re-verified against its published checksum before it is reused, so a corrupted cache is discarded and re-fetched rather than packaged.

A pnpm project needs a `flatpak-node-generator` that supports `--pnpm-store-version`, the option that picks the layout of the vendored pnpm store. `gtkx deploy` checks the copy on your `PATH` for that option and treats one without it as missing. The option is newer than the generator's last tagged release, so for now it means installing from the project's default branch. npm and yarn projects work with any release.

When a required tool is missing, `gtkx deploy` lists every one of them at once, with the install command for your distribution. `--print-manifests` needs none of the packaging tools, only the validators.

## Reviewing what it generates

```bash
gtkx deploy --print-manifests
```

writes the desktop entry, the AppStream metainfo, and each target's manifest, validates them, and stops without packaging.

Validation always fails on an AppStream error. A *warning*, such as a missing homepage, fails only when a target that publishes to a software center is selected, which today means `flatpak`; for `deb`, `rpm`, and `appimage` it is reported and the build continues. Either way the message names the config key that fixes it:

```
The AppStream metainfo is not valid:
W: com.example.Tasks:~: url-homepage-missing

Fix it in gtkx.config.ts:
  url-homepage-missing: set `deploy.homepage`, or `homepage` in package.json
```

`--skip-build` packages what is already in `dist/` instead of rebuilding, and `--out` changes the output directory, which defaults to `build`.

## Customize a package

Keep packaging adjustments in `deploy`. You can add desktop metadata, Flatpak permissions and build steps, package dependencies, extra files, maintainer scripts, and signing. Set minimum native-library versions when the application uses APIs newer than a distribution's baseline. Flatpak builds in containers can also disable `rofiles-fuse` when FUSE is unavailable.

Use `defineConfig` completion and the [`@gtkx/config` reference](/reference/@gtkx/config/) for the available options and their exact shapes.

## Publishing on Flathub

`gtkx deploy --target flatpak` builds from the tree it just staged, which is fast and fully offline, but Flathub builds every submission from source. `deploy.flatpak.mode: "source"` emits a manifest that does exactly that: a `git` source pinned to your release, dependencies vendored offline with [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node), and the generated metadata carried inline so nothing generated has to be committed.

The MIME package your `fileAssociations` generate rides along inline, like the desktop entry and the metainfo. Your license file and every `deploy.extraFiles` entry install straight out of the checkout, so each has to live inside the repository and be committed; one that points outside fails the deploy.

The lockfile in your project root picks which package manager the sandbox installs with, and npm, pnpm, and yarn all work. pnpm takes one extra source, because the Node SDK extension ships no pnpm and the sandbox has no network to fetch one, so the manifest vendors the pnpm tarball itself. The version comes from `packageManager` in your `package.json`: write it with `corepack use pnpm@<version>`, which records the `sha512` digest every Flathub source has to carry. Pin pnpm 10, or 11.3.0 and newer, where `--trust-lockfile` skips the registry check the sandbox cannot complete.

[Shipping It on Flathub](/tutorial/flatpak) walks through the submission.

## Next

The [API reference](/reference/) documents GTKX's public TypeScript APIs.
