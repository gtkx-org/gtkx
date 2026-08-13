---
title: "GTKX 1.1: gtkx deploy"
description: "GTKX 1.1 adds gtkx deploy, which builds a Flatpak, a .deb, an .rpm, or an AppImage from a GTKX project. The desktop entry, the AppStream metadata, the Flatpak manifest, and the package control files are generated from a deploy block in gtkx.config.ts."
image: /tasks-screenshot.png
---

# GTKX 1.1

<p class="post-date">August 11, 2026</p>

GTKX 1.1 is out. It is a small release introducing a new `gtkx deploy` command, in addition to several bug fixes. Read the [`changelog`](https://github.com/gtkx-org/gtkx/releases/tag/v1.1.0) for the full list of changes.

1.0 shipped with a tutorial that ended in a packaging appendix. The appendix asked you to write two esbuild scripts, a shell script, a `sea-config.json`, a desktop entry, an AppStream metainfo file, a Flatpak manifest, and two more shell scripts to drive all of it, then keep the application ID in sync across the lot by hand. It worked, and it ended in a Flathub submission, which was the point. But it was eleven files of packaging for an app with a few hundred lines of source, and almost none of it was specific to the app. That is the sort of thing a framework should be doing for you.

```bash
gtkx deploy
```

## Configuration

Everything the command needs lives in a `deploy` block in `gtkx.config.ts`:

```ts
deploy: {
    summary: "Manage your tasks and to-dos",
    categories: ["Office"],
    targets: ["flatpak", "deb", "rpm", "appimage"],
},
```

From that it generates the desktop entry and the AppStream metainfo, then builds a `.flatpak`, a `.deb`, an `.rpm`, and an `.AppImage`.

Most of the remaining metadata is derived rather than configured. Name, version, license, developer, homepage, and description fall back to `package.json`. Icons come from the `data/icons/` tree that `gtkx build` already reads. The deb `Section` and the rpm `Group` come from the categories. Distribution dependencies come from the libraries you already declared, so `libraries: ["Gtk-4.0", "Adw-1"]` becomes `libgtk-4-1, libadwaita-1-0` on Debian and `gtk4, libadwaita` on Fedora, and the glibc floor is read out of the built binaries rather than guessed. If you run the command with no `deploy` block at all, it prints a starter one with everything derivable already filled in.

## Metadata is validated before the build

The desktop entry and the metainfo depend only on configuration, so they are rendered and validated early, before the app is bundled. A category typo or a summary ending in a period fails in about two seconds, with the validator's own message, rather than after a full Flatpak build.

AppStream is where the command is stricter than the exit code it gets: an error and a warning both stop the deploy, for every format, because every one of them ships the same metainfo to a software center, and the message names the config key that fixes the rule. Advisory infos are reported and let through. The desktop entry is the lenient one, since `desktop-file-validate` calls things like a missing main category a hint: its errors stop the deploy, and its warnings and hints are reported while the build continues.

## What the output looks like

There is a single staged payload, and every target installs it unchanged:

```
bin/<app>                     a launcher script
lib/<app>/node                the bundled Node.js
lib/<app>/bundle.js           the app
lib/<app>/gtkx.node           the native addon
share/...                     desktop entry, metainfo, icons, schemas
```

It goes under `/usr` for deb, rpm, and AppImage, and under `/app` for Flatpak. Nothing has to be rewritten between the two, because the launcher resolves everything relative to its own location and the bundle resolves the addon and the compiled schemas from beside itself. AppImage was not in the original plan for this release. Once the staging step existed, adding it was one module over the same tree, so it went in.

## Flathub

`gtkx deploy --target flatpak` builds from the staged tree, offline, in seconds. Flathub builds every submission from source instead, so `deploy.flatpak.mode: "source"` emits a manifest that does the same: a `git` source pinned to your release, built in the project's own subdirectory of the clone, npm dependencies vendored for the network-isolated sandbox with `flatpak-node-generator`, and the generated metadata carried as inline sources, so nothing generated has to be committed to the repository. It wants a `package-lock.json` or a `yarn.lock`, because the Node SDK extension the sandbox mounts carries npm and yarn and has no network to fetch anything else.

Sandbox permissions are the one thing still written by hand. They are a security decision rather than something to infer from configuration, and the default asks for a window and hardware rendering and nothing else.

## What you need installed

`nfpm` builds the `.deb` and the `.rpm` without `dpkg` or `rpmbuild`, so a Fedora machine can build Debian packages and a Debian machine can build RPMs. It and `appimagetool` are downloaded, checksum-verified against pinned digests, and cached under `~/.cache/gtkx/`.

What you do have to install yourself is `desktop-file-validate`, `appstreamcli`, and, for Flatpak, `flatpak-builder`. When any of them is missing, `gtkx deploy` lists all of them at once, with the install command for your distribution.

## Upgrading

There are no breaking changes in 1.1. Add a `deploy` block, delete your packaging scripts, and read [Deploying](/guide/deploying) for the full field reference. The tutorial's [Appendix B](/tutorial/packaging) and [Appendix C](/tutorial/flatpak) have been rewritten around the command.

## What's next

The [roadmap](https://github.com/orgs/gtkx-org/projects/1) continues with [`@gtkx/animated`](https://github.com/gtkx-org/gtkx/issues/478) on top of React Spring, [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) on top of Adwaita and React Navigation, and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480). That order is not fixed; if something else would help you more, the [issue tracker](https://github.com/gtkx-org/gtkx/issues) is where it gets argued about.
