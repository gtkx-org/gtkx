---
description: "Turn a GTKX project into a Flatpak, a .deb, an .rpm, or an AppImage with one command."
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
| deb `Depends`, rpm `Requires` | GTK, libadwaita, and the glibc minimum read out of the built binaries. Every other dependency is yours to declare through `deploy.depends` |
| `screenshotBaseUrl` | the `origin` git remote, including the project's path inside the repository |

The application icon is the one thing that has to exist. Set the top-level `applicationIcon` option to an
icon-theme directory such as `data/icons`, or to a single image. In a directory, the primary file must be under
`hicolor/<size>/apps` and its name must match the application ID because the desktop entry names that ID as its
icon. Sizes can be `scalable`, `symbolic`, a square pixel size, or a scaled pixel size such as `128x128@2`; GTKX
preserves the whole theme tree and its variants. You can omit the option when exactly one `<applicationId>.svg`,
`.png`, or `.xpm` file is in the project root; deploying without any icon still fails.

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

Each source is collected on its own:

- **The bundled Node.js.** Its `LICENSE` is extracted from the release archive the deploy already downloaded and verified. That one file is the aggregate notice covering V8, OpenSSL, ICU, libuv, zlib, brotli, llhttp, and everything else Node.js embeds. With `deploy.node.source: "host"` or `"path"` there is no archive, so the license is looked for beside the binary, at `<dir>/LICENSE` and `<dir>/../LICENSE`, which is where an official release unpacks it. A file found there is taken only when its text names Node.js, so pointing `deploy.node.path` at a binary inside your own project does not publish your project's `LICENSE` as Node's. When no Node.js license is found, the deploy warns and the notices name the runtime with a link to its license in place of the text.
- **GTKX.** The MPL-2.0 notice, the GTKX modules that went into the bundle, and a pointer to the source of the release they came from, which is what section 3.2(a) of that license asks you to give whoever receives the executable. The native addon also statically links Rust crates GTKX did not write, so the section says so and names the licenses they carry — MIT, Apache-2.0, ISC, and Unicode-3.0 — with a pointer to the manifest that records which crates and which versions went in.
- **The JavaScript dependencies.** `gtkx build` records which packages the module graph of `dist/bundle.mjs` actually reaches, resolving every module id back through the pnpm symlinks to the package that owns it, and writes each one's name, version, and directory relative to `dist/` to the `packages` array in `dist/gtkx-schemas.json`. The deploy reads each package's license file, or its SPDX identifier when it ships no file, and reproduces what it finds, holder by holder. A package that declares neither is still listed, and the deploy warns naming it, because terms nobody recorded are the one thing generated notices cannot settle for you. A package whose recorded directory is no longer there — a pruned `node_modules`, or a `dist/` moved to another machine — is still listed by the name and version the build recorded, with a warning of its own, rather than dropped.
- **The introspected libraries.** GTK, libadwaita, GtkSourceView, and WebKitGTK are reached through GObject introspection and resolved when the app runs, from the host system or from the GNOME runtime. No copy of them is in the package. The native addon does link GLib, GObject, and GIO against the copies already installed on the machine, which makes it a work that uses those libraries, so the section carries what LGPL-2.1 section 6 asks of one: the notice that they are used and covered by that license, the address the license itself is published at, and the address each library's own copyright notice is published at. Linking against an installed shared library is the mechanism section 6(b) allows, so their source does not have to travel with the package.

`dist/gtkx-schemas.json` is versioned build metadata, identified by `generator: "gtkx-build"` and
`formatVersion: 1`, and never reaches a package. Its `schemas` array records the raw schema files reached by the
module graph so deploy can install them, while its `packages` array records the dependencies used for notices.
Schema paths are relative to the project root; package directories are relative to `dist/` and can contain `..`
when a dependency lives in a workspace or package-manager store.
The separate `gschemas.compiled` is runtime data and does reach the package. `--skip-build` reads the metadata
out of the `dist/` it packages, so a tree built by an older `gtkx build` has to be built once more.
`--print-manifests` downloads nothing, so a preview carries the link to the Node.js license rather than its text.

`deploy.flatpak.mode: "source"` builds in the sandbox instead of packaging a staged tree, so the notices ride along as an inline source and install exactly where the prebuilt mode installs them. That build takes its runtime from the Node SDK extension rather than from an archive. It installs the license file that extension ships as `share/licenses/<binaryName>/node/LICENSE` when the extension ships one, and installs nothing when it does not, which is what the notices say: they name the license and the address it is published at rather than claiming a file is there.

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

## Escape hatches

The generated files are complete, but nothing is a dead end:

- `deploy.desktopEntry` adds or overrides desktop entry keys.
- `deploy.flatpak.finishArgs` adds sandbox permissions to the defaults `--share=ipc`, `--socket=wayland`, `--socket=fallback-x11`, and `--device=dri`, which grant a window and hardware rendering and nothing else. Yours follow the defaults, and duplicates collapse. To drop a default, ask for its negation: `--nosocket=wayland`, `--unshare=ipc`, `--nodevice=dri`. `gtkx deploy` warns when the result grants no display socket, and when an app declaring `WebKit-6.0` has no `--share=network`.
- `deploy.flatpak.cleanup` adds cleanup patterns to the defaults `/include`, `/share/pkgconfig`, `*.la`, and `*.a`. There is no negation for a pattern; an empty array turns cleanup off altogether, for a project that has to keep its headers or static libraries in the prefix.
- `deploy.flatpak.modules` and `deploy.flatpak.buildCommands` add modules and build steps.
- `deploy.depends` and `deploy.relations` add package relationships per format. They only ever add, so they can tighten a generated relation but never loosen one.
- `deploy.minimumLibraryVersions` requires a library at a version or later: `{ "Gtk-4.0": "4.14" }` writes `libgtk-4-1 (>= 4.14)` and `gtk4 >= 4.14`. Name as many segments as you need — `"4.18.6"` pins a patch release, for a fix a distribution backported. A library you leave out is required by name alone, which installs on a host whose copy is older than the one you built against; GTK and libadwaita resolve symbol by symbol when the app runs, so such a host starts the app and then dies at the first call its older copy does not export. Set a minimum for every library whose newer API you rely on.
- `deploy.extraFiles` maps prefix-relative destinations to source paths, each resolved against the project root. An entry keeps its source file's executable bit and is installed `644` otherwise. Write `{ source: "tools/helper", mode: "755" }` in place of a plain path to set the mode yourself.
- `deploy.scripts` supplies maintainer scripts. Without them the packages rely on the distribution's own triggers to refresh the desktop, icon, and schema caches, which is what a well-behaved package should do.
- `deploy.signing` signs the `.deb`, the `.rpm`, the Flatpak repository, or the AppImage.

If the build stops at `Failure spawning rofiles-fuse`, it is running somewhere FUSE is unavailable, such as a container. Set `deploy.flatpak.shouldUseRofilesFuse: false`.

## Publishing on Flathub

`gtkx deploy --target flatpak` builds from the tree it just staged, which is fast and fully offline, but Flathub builds every submission from source. `deploy.flatpak.mode: "source"` emits a manifest that does exactly that: a `git` source pinned to your release, dependencies vendored offline with [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node), and the generated metadata carried inline so nothing generated has to be committed.

The MIME package your `fileAssociations` generate rides along inline, like the desktop entry and the metainfo. Your license file and every `deploy.extraFiles` entry install straight out of the checkout, so each has to live inside the repository and be committed; one that points outside fails the deploy.

The lockfile in your project root picks which package manager the sandbox installs with, and npm, pnpm, and yarn all work. pnpm takes one extra source, because the Node SDK extension ships no pnpm and the sandbox has no network to fetch one, so the manifest vendors the pnpm tarball itself. The version comes from `packageManager` in your `package.json`: write it with `corepack use pnpm@<version>`, which records the `sha512` digest every Flathub source has to carry. Pin pnpm 10, or 11.3.0 and newer, where `--trust-lockfile` skips the registry check the sandbox cannot complete.

[Shipping It on Flathub](/tutorial/flatpak) walks through the submission.

## Next

The [API reference](/reference/) documents every package.
