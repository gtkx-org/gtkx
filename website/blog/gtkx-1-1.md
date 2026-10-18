---
title: "GTKX 1.1: Introducing gtkx deploy"
description: "GTKX 1.1 introduces gtkx deploy for Flatpak, Debian, RPM, and AppImage packages."
image: /tasks-screenshot.png
---

# GTKX 1.1

<p class="post-date">August 11, 2026</p>

GTKX 1.1 adds the `gtkx deploy` command and fixes bugs. Read the [changelog](https://github.com/gtkx-org/gtkx/releases/tag/v1.1.0) for the full list of changes.

The 1.0 tutorial maintained build scripts, desktop metadata, and a Flatpak manifest by hand. GTKX 1.1 generates these files from the application configuration:

```bash
gtkx deploy
```

## Configuration

Set deployment options in the `deploy` block of `gtkx.config.ts`:

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

The desktop entry and AppStream metadata are generated and validated before bundling. Invalid metadata stops the build with the validator's message and the relevant configuration key.

In 1.1, AppStream errors and warnings stop deployment for every format; informational messages are reported without stopping it. For desktop entries, `desktop-file-validate` errors stop deployment, while warnings and hints allow the build to continue.

## What the output looks like

There is a single staged payload, and every target installs it unchanged:

```
bin/<app>                     a launcher script
lib/<app>/node                the bundled Node.js
lib/<app>/bundle.mjs          the app
lib/<app>/gtkx.node           the native addon
share/...                     desktop entry, metainfo, icons, schemas
```

The payload goes under `/usr` for Debian, RPM, and AppImage, and under `/app` for Flatpak. The launcher resolves paths relative to its location, and the bundle loads the addon and compiled schemas from beside itself. Each format uses the same staged tree.

## Flathub

`gtkx deploy --target flatpak` builds a Flatpak from the staged application. Preparing the runtime and build dependencies may require downloads. For a Flathub source build, `deploy.flatpak.mode: "source"` emits a manifest pinned to a Git release. It uses `flatpak-node-generator` to vendor npm dependencies and embeds generated metadata as inline sources. In 1.1, this requires a `package-lock.json` or `yarn.lock`, matching the package managers available in the Node SDK extension.

Configure sandbox permissions explicitly. The defaults allow display access and hardware rendering; add permissions only when the application needs them.

## What you need installed

`nfpm` builds the `.deb` and the `.rpm` without `dpkg` or `rpmbuild`, so a Fedora machine can build Debian packages and a Debian machine can build RPMs. It and `appimagetool` are downloaded, checksum-verified against pinned digests, and cached under `~/.cache/gtkx/`.

What you do have to install yourself is `desktop-file-validate`, `appstreamcli`, and, for Flatpak, `flatpak-builder`. When any of them is missing, `gtkx deploy` lists all of them at once, with the install command for your distribution.

## Upgrading

There are no breaking changes in 1.1. Add a `deploy` block and check the generated packages before removing old packaging scripts. The [1.1 deployment guide](https://github.com/gtkx-org/gtkx/blob/v1.1.0/website/guide/deploying.md) records the release's configuration. The maintained [Deploying guide](/guide/deploying) and tutorial chapters on [packaging](/tutorial/packaging) and [Flatpak](/tutorial/flatpak) include later 1.x updates.

## What's next

The [roadmap](https://github.com/orgs/gtkx-org/projects/1) continues with [`@gtkx/animated`](https://github.com/gtkx-org/gtkx/issues/478) on top of React Spring (shipped in [1.3](/blog/gtkx-1-3)), [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) on top of Adwaita and React Navigation (shipped in [1.4](/blog/gtkx-1-4)), and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480) on top of React Hook Form (shipped in [1.5](/blog/gtkx-1-5)). Further work is tracked in [issues](https://github.com/gtkx-org/gtkx/issues).
