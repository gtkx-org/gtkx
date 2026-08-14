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
    libraries: ["Gtk-4.0"],
    applicationId: "com.example.Tasks",
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
| `icons` | `<dataDir>/icons`, the same tree `gtkx build` reads |
| `releases` | one entry, from the version and today's date |
| deb `section`, rpm `group` | the first entry in `categories` |
| deb `Depends`, rpm `Requires` | the `libraries` you declared, plus the glibc floor read out of the built binaries |
| `screenshotBaseUrl` | the `origin` git remote, including the project's path inside the repository |

The application icon is the one thing that has to exist: `data/icons/hicolor/scalable/apps/<applicationId>.svg`. The desktop entry names `<applicationId>` as its icon, so the file name has to match, and `gtkx deploy` says so if it does not.

## What gets installed

Every target installs the same tree, under `/usr` for deb, rpm, and AppImage, and under `/app` for Flatpak:

```
bin/<binaryName>                              a launcher script
lib/<binaryName>/node                         the bundled Node.js
lib/<binaryName>/bundle.mjs                   the app
lib/<binaryName>/gtkx.node                    the native addon
lib/<binaryName>/gschemas.compiled            compiled settings schemas
share/applications/<id>.desktop               generated
share/metainfo/<id>.metainfo.xml              generated
share/icons/hicolor/**/apps/<id>.svg          copied from data/icons
share/glib-2.0/schemas/<id>*.gschema.xml      copied from data/
```

`bundle.mjs`, `gtkx.node`, and the compiled schemas are siblings because the built bundle resolves them all relative to itself. The launcher resolves everything from its own location, so the same tree works at `/usr`, at `/app`, and inside an AppImage mount point.

## Why Node.js is bundled

GTKX needs Node.js 24, and Debian 13 ships 20 while Ubuntu 26.04 ships 22, so the package cannot depend on the distribution's. `gtkx deploy` downloads the official `nodejs.org` build matching the Node.js you are running and verifies it against the published SHA-256. The release archive is cached under `~/.cache/gtkx/node/` and re-verified on every reuse, so only the first deploy needs network access. That costs about 100 MiB per package.

`deploy.node.source` changes where it comes from:

- `"download"` (default) fetches and verifies the official build.
- `"host"` copies the Node.js running the build. Fully offline, but rejected with an explanation when that binary links against something the target machine will not have, which is the case for the Node.js packages Fedora and Debian ship.
- `"path"` uses `deploy.node.path`.

## Tools you need installed

`desktop-file-validate` and `appstreamcli` are always required, because they are what catch a metadata mistake before it reaches a software center. `tar` is required whenever packages are actually built, since the bundled Node.js is extracted from its release archive. Beyond that it depends on the target:

| Target | Needs | Fetched automatically |
| --- | --- | --- |
| `flatpak` | `flatpak`, and either `flatpak-builder` or the `org.flatpak.Builder` Flatpak | the GNOME runtime |
| `flatpak` with `mode: "source"` | the above, plus `flatpak-node-generator` | |
| `deb`, `rpm` | | `nfpm` |
| `appimage` | `file` | `appimagetool` and the AppImage runtime |

`nfpm` and `appimagetool` are downloaded, checksum-verified, and cached under `~/.cache/gtkx/`, so building a `.deb` on Fedora and an `.rpm` on Debian both work without installing anything distribution-specific. Only the archives are cached, and each is re-verified against its published checksum before it is reused, so a corrupted cache is discarded and re-fetched rather than packaged.

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
- `deploy.flatpak.finishArgs` replaces the sandbox permissions, which default to a window and hardware rendering and nothing else.
- `deploy.flatpak.modules` and `deploy.flatpak.buildCommands` add modules and build steps.
- `deploy.depends` and `deploy.relations` add package relationships per format.
- `deploy.extraFiles` maps prefix-relative destinations to files in the project.
- `deploy.scripts` supplies maintainer scripts. Without them the packages rely on the distribution's own triggers to refresh the desktop, icon, and schema caches, which is what a well-behaved package should do.
- `deploy.signing` signs the `.deb`, the `.rpm`, the Flatpak repository, or the AppImage.

If the build stops at `Failure spawning rofiles-fuse`, it is running somewhere FUSE is unavailable, such as a container. Set `deploy.flatpak.shouldUseRofilesFuse: false`.

## Publishing on Flathub

`gtkx deploy --target flatpak` builds from the tree it just staged, which is fast and fully offline, but Flathub builds every submission from source. `deploy.flatpak.mode: "source"` emits a manifest that does exactly that: a `git` source pinned to your release, dependencies vendored offline with [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node), and the generated metadata carried inline so nothing generated has to be committed.

[Shipping It on Flathub](/tutorial/flatpak) walks through the submission.

## Next

The [API reference](/reference/) documents every package.
