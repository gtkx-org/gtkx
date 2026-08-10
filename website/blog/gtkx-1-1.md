---
title: "GTKX 1.1: gtkx deploy"
description: "One command turns a GTKX project into a Flatpak, a .deb, an .rpm, and an AppImage. The desktop entry, the AppStream metadata, the Flatpak manifest, and the package control files are all generated from one block in gtkx.config.ts."
image: /tasks-screenshot.png
---

# GTKX 1.1

<p class="post-date">August 11, 2026</p>

Writing a GTK4 app in React has been the easy part since 1.0. Shipping it was not.

Until today the tutorial's packaging appendices asked you to write two esbuild scripts, a shell script, a `sea-config.json`, a desktop entry, an AppStream metainfo file, a Flatpak manifest, and two more shell scripts to drive it, then keep the application ID consistent across all nine by hand. That is eleven files of packaging for an app whose source is a few hundred lines.

1.1 replaces all of it:

```bash
gtkx deploy
```

## One block, four packages

Everything `gtkx deploy` needs lives in one `deploy` block in `gtkx.config.ts`:

```ts
deploy: {
    summary: "Manage your tasks and to-dos",
    categories: ["Office"],
    targets: ["flatpak", "deb", "rpm", "appimage"],
},
```

From that it generates and validates the desktop entry and the AppStream metainfo, then builds a `.flatpak`, a `.deb`, an `.rpm`, and an `.AppImage`. The name, version, license, developer, homepage, and description all fall back to `package.json`, the icons come from the `data/icons/` tree `gtkx build` already reads, and the deb `Section` and rpm `Group` are derived from the categories you gave. Run it with no `deploy` block at all and it prints a starter one with every derivable value filled in.

The distribution dependencies are derived too. `libraries: ["Gtk-4.0", "Adw-1"]` becomes `libgtk-4-1, libadwaita-1-0` on Debian and `gtk4, libadwaita` on Fedora, and the glibc floor is read out of the built binaries rather than guessed.

## The metadata is checked before the build

The desktop entry and the metainfo depend only on configuration, so they are rendered and validated in the second step, before the app is even bundled. A category typo or a summary ending in a period fails in about two seconds, with the validator's own message, rather than after a full Flatpak build.

Both gates are strict. `desktop-file-validate` reports a missing main category only as a hint, which exits zero; `gtkx deploy` treats any output from it as a failure, because a desktop entry that lands in a launcher's catch-all section is a defect you want to hear about at build time.

## One tree, four prefixes

There is one staged payload, and every target installs it unchanged:

```
bin/<app>                     a launcher script
lib/<app>/node                the bundled Node.js
lib/<app>/bundle.js           the app
lib/<app>/gtkx.node           the native addon
share/...                     desktop entry, metainfo, icons, schemas
```

It grafts onto `/usr` for deb, rpm, and AppImage, and onto `/app` for Flatpak, because the launcher resolves everything from its own location and the bundle resolves the addon and the compiled schemas from beside itself. Adding a fifth format is one module over the same tree, which is how AppImage joined the list after the plan was written.

## No single executable

1.0's tutorial packed the app into a Node.js Single Executable Application. 1.1 does not, deliberately. A SEA is a `node` binary with a blob injected into it, and `strip`, `dh_strip`, and rpm's `find-debuginfo` all corrupt it silently: the package builds, installs, and then dies. An ordinary `node` beside `bundle.js` is a normal ELF that every packaging system may strip freely, and `NODE_COMPILE_CACHE` closes the startup gap.

Node.js is bundled rather than depended on because GTKX needs 24, Debian 13 ships 20, and Ubuntu 26.04 ships 22. `gtkx deploy` fetches the official `nodejs.org` build matching the one you are running and verifies its SHA-256 against the published checksums. Copying your system's `node` is available as `deploy.node.source: "host"`, and is rejected with an explanation when that binary links against `libnode.so`, which is exactly what Fedora's and Debian's packages do and what would otherwise produce a package that installs and then cannot start.

## Flathub

`gtkx deploy --target flatpak` builds from the staged tree, offline, in seconds. Flathub requires that submissions build from source, so `deploy.flatpak.mode: "source"` emits a manifest that does: a `git` source pinned to your release, npm dependencies vendored for the network-isolated sandbox with `flatpak-node-generator`, and the generated metadata carried as inline sources so nothing generated has to be committed.

Sandbox permissions stay hand-authored. They are a security decision, not a derivable one, and the default asks only for a window and hardware rendering.

## Nothing else to install

`nfpm` builds the `.deb` and the `.rpm` without `dpkg` or `rpmbuild`, so a Fedora machine builds Debian packages and a Debian machine builds RPMs. It and `appimagetool` are downloaded, checksum-verified against pinned digests, and cached under `~/.cache/gtkx/`. What you do need is `desktop-file-validate`, `appstreamcli`, and, for Flatpak, `flatpak-builder`; when any is missing, `gtkx deploy` lists all of them at once with the install command for your distribution.

## Upgrading

Nothing in 1.1 is a breaking change. Add a `deploy` block, delete your packaging scripts, and read [Deploying](/guide/deploying) for the full field reference. The tutorial's [Appendix B](/tutorial/packaging) and [Appendix C](/tutorial/flatpak) have been rewritten around the command.

## What's next

The [roadmap](https://github.com/orgs/gtkx-org/projects/1) continues with [`@gtkx/animated`](https://github.com/gtkx-org/gtkx/issues/478) on top of React Spring, [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) on top of Adwaita and React Navigation, and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480). If something else should come first, say so on the [issue tracker](https://github.com/gtkx-org/gtkx/issues).
