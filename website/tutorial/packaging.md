---
description: "Give the finished app an icon, a desktop entry, AppStream metadata, and installable packages."
---

# Appendix B: Making It a Real Application

[Appendix A](/tutorial/testing) left you with a test suite. Nothing here changes what the app does. This appendix closes the gap between an app that runs from your project directory and one that installs, appears in the overview under its own icon, and carries the metadata a software center expects.

## Name the release

The scaffold started at version `0.0.1` with placeholder package metadata. Give this release the identity used by its About dialog and package names:

```bash
npm pkg set \
    name=gtkx-tutorial \
    version=1.0.0 \
    license=MPL-2.0 \
    description="Tasks app from the GTKX tutorial" \
    author="GTKX <hello@gtkx.dev>" \
    homepage=https://gtkx.dev
npm install --package-lock-only
```

The second command updates the root entry in `package-lock.json`, which the source-mode Flatpak later installs from without network access. Save a copy of the [Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/) as `LICENSE` in the project root too. Package metadata identifies the license; that file gives recipients its actual terms.

## What the build produces

Leave the dev server running. `gtkx build` writes to `dist/`, which the dev server never reads, so they coexist.

```bash
npm run build
```

```
> gtkx-tutorial@1.0.0 build
> gtkx build

[gtkx] Building ~/tasks/src/index.tsx
vite v8.2.1 building ssr environment for production...
[gtkx] Queued GSettings schema: com.gtkx.tutorial.gschema.xml
[gtkx] Compiled 1 GSettings schema(s)
[gtkx] Copied 2 icon(s) into icons/
✓ 256 modules transformed.
rendering chunks...
computing gzip size...
dist/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg      0.49 kB │ gzip:   0.28 kB
dist/gschemas.compiled                                               0.63 kB
dist/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg               1.47 kB │ gzip:   0.38 kB
dist/gtkx-schemas.json                                               2.02 kB │ gzip:   0.39 kB
dist/gtkx.node                                                   1,624.69 kB
dist/bundle.mjs                                                  4,067.30 kB │ gzip: 510.94 kB

✓ built in 694ms
[gtkx] Build complete: dist/bundle.mjs
```

The runtime finds `gschemas.compiled`, the icons, and `gtkx.node` relative to the bundle: it prepends its own
directory to `GSETTINGS_SCHEMA_DIR` and `XDG_DATA_DIRS`, and loads the native addon from beside itself. An app
that imports `?resource` or `?icon` assets also gets a sibling `gtkx.gresource`, which generated modules load and
register automatically. Keep those files together and the app is self-contained. Move `bundle.mjs` on its own
and the settings schema goes missing on the first `useSetting` call.

`gtkx-schemas.json` is build metadata for `gtkx deploy`, not a runtime file. It identifies the metadata format and
records both the schema sources and JavaScript packages reached by the bundle; deploy consumes it without placing
it in the installed application.

`node dist/bundle.mjs` runs the app on any machine with Adwaita, GTK4, and Node.js 24 installed. That works, but it is not yet something a user can double-click.

## Icons

The top-level `applicationIcon: "data/icons"` setting tells the build to copy that directory verbatim, so the
layout you write is the layout that ships. Use the same shape as the system icon theme:

```
data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg
data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg
```

`hicolor` is the fallback theme every icon theme inherits from, `scalable` is where SVGs go, and `apps` is the context. The file name is the application ID, which both the desktop entry's `Icon` key and the About dialog's `applicationIcon` prop look up.

The full-color icon is a 128 by 128 SVG. The symbolic variant is a separate 16 by 16 drawing in a single flat fill, so the desktop can recolor it for a dark header bar or a notification badge.

`data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg height="16px" viewBox="0 0 16 16" width="16px" xmlns="http://www.w3.org/2000/svg">
    <path d="m 5 1 c -2.216 0 -4 1.784 -4 4 v 6 c 0 2.216 1.784 4 4 4 h 6 c 2.216 0 4 -1.784 4 -4 v -6 c 0 -2.216 -1.784 -4 -4 -4 z m 0 2 h 6 c 1.108 0 2 0.892 2 2 v 6 c 0 1.108 -0.892 2 -2 2 h -6 c -1.108 0 -2 -0.892 -2 -2 v -6 c 0 -1.108 0.892 -2 2 -2 z" fill="#241f31"/>
    <path d="m 4.5 8.5 l 2.5 2.5 l 5.5 -5.5 l -1.5 -1.5 l -4 4 l -1 -1 z" fill="#241f31"/>
</svg>
```

## Telling the desktop about the app

A desktop entry makes the app something the desktop knows about rather than a path you type, and an AppStream metainfo file is what a software center reads. Both are generated, from one block in `gtkx.config.ts`:

```ts
deploy: {
    name: "Tasks",
    genericName: "Task Manager",
    binaryName: "gtkx-tutorial",
    summary: "Manage your tasks and to-dos",
    description: [
        "A GNOME task manager built with GTKX, demonstrating how to build React-based Adwaita applications.",
        "It shows an adaptive sidebar layout, boxed lists, a task editor, GSettings-backed preferences, "
        + "undo toasts, drag-to-reorder, desktop notifications, and local JSON persistence.",
    ],
    categories: ["Office", "ProjectManagement"],
    keywords: ["Task", "Tasks", "Todo", "To-do", "Checklist"],
    developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
    homepage: "https://gtkx.dev",
    urls: {
        bugtracker: "https://github.com/gtkx-org/gtkx/issues",
        "vcs-browser": "https://github.com/gtkx-org/gtkx",
    },
    screenshots: [
        { file: "assets/screenshot.png", caption: "Browsing task lists in the sidebar", isDefault: true },
        { file: "assets/screenshot-editor.png", caption: "Editing a task" },
    ],
    screenshotBaseUrl: "https://raw.githubusercontent.com/gtkx-org/gtkx/v1.6.0/examples/tutorial",
    releases: [{ version: "1.0.0", date: "2026-07-13", notes: ["Initial release."] }],
    branding: { light: "#3584e4", dark: "#1a5fb4" },
    contentRating: {},
    isDbusActivatable: true,
    desktopEntry: { "X-GNOME-UsesNotifications": "true" },
    targets: ["flatpak", "deb", "rpm", "appimage"],
},
```

Most of it is optional. `name`, `version`, `license`, `developer`, and `homepage` all fall back to `package.json`, and `summary` falls back to its `description`, so the smallest working block is a `summary` and a `categories` list. The tutorial spells everything out because it doubles as a reference.

A few keys earn their place. `X-GNOME-UsesNotifications` gives the app its own row in the desktop's notification settings, so the reminders from [Reminders That Reach the Desktop](/tutorial/reminders) can be tuned or silenced there. `isDbusActivatable` lets the desktop start the app over D-Bus instead of running the command directly, which is how a reminder's **Mark Complete** button reaches the `app.complete-task` action when the app is closed.

`categories` also decides where the app appears in a launcher that groups by category, and it is what the deb `Section` and the rpm `Group` are derived from.

`screenshotBaseUrl` turns each relative screenshot `file` into a URL a software center can fetch. The tutorial uses the canonical images from the GTKX repository. For your own application, point it at the directory where the committed screenshots are publicly served, or give each screenshot an absolute `url` instead.

## One command

```bash
npm run deploy
```

```
[gtkx] Deploying Tasks 1.0.0-1 as gtkx-tutorial (x86_64) to appimage, deb, flatpak, rpm
[gtkx] Building ~/tasks/src/index.tsx
[gtkx] Validated the desktop entry and the metainfo
[gtkx] Bundled Node.js v24.19.0 (100.8 MiB, glibc >= 2.28)
[gtkx] Staged 10 files into build/stage
[gtkx] Wrote build/targets/appimage/AppRun
[gtkx] Wrote build/targets/deb/nfpm.yaml
[gtkx] Wrote build/targets/flatpak/com.gtkx.tutorial.yml
[gtkx] Wrote build/targets/rpm/nfpm.yaml
[gtkx] Built build/out/Tasks-1.0.0-x86_64.AppImage (36.9 MiB)
[gtkx] Built build/out/gtkx-tutorial_1.0.0-1_amd64.deb (40.6 MiB)
[gtkx] Built build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak (26.4 MiB)
[gtkx] Built build/out/gtkx-tutorial-1.0.0-1.x86_64.rpm (40.5 MiB)
[gtkx] Deploy complete: 4 artifacts in build/out
```

The command regenerates the project types, builds the application, validates its desktop entry and metainfo, stages one install tree, and turns that tree into every requested format. The next chapter adds a translation catalog; the same command will then own its extraction, synchronization, compilation, metadata localization, and packaging too.

Node.js is bundled into the package. GTKX needs Node.js 24, Debian 13 ships 20, and Ubuntu 26.04 ships 22, so the package cannot depend on the distribution's. `gtkx deploy` fetches the official build matching yours, verifies its checksum, and caches it, which is where most of each package's size comes from.

## What is inside

Every package installs the same tree, under `/usr` here and under `/app` in the Flatpak, apart from where the notices land:

```
/usr/bin/gtkx-tutorial                                    a launcher script
/usr/lib/gtkx-tutorial/node                               the bundled Node.js
/usr/lib/gtkx-tutorial/bundle.mjs                         the app
/usr/lib/gtkx-tutorial/gtkx.node                          the native addon
/usr/lib/gtkx-tutorial/gschemas.compiled                  the compiled schema
/usr/share/applications/com.gtkx.tutorial.desktop         generated
/usr/share/dbus-1/services/com.gtkx.tutorial.service      generated
/usr/share/metainfo/com.gtkx.tutorial.metainfo.xml        generated
/usr/share/icons/hicolor/**/apps/com.gtkx.tutorial.svg    from applicationIcon
/usr/share/glib-2.0/schemas/com.gtkx.tutorial.gschema.xml from its source import
/usr/share/licenses/gtkx-tutorial/LICENSE                 your LICENSE, every target but deb
/usr/share/licenses/gtkx-tutorial/THIRD-PARTY-NOTICES     generated, every target but deb
/usr/share/doc/gtkx-tutorial/copyright                    generated, deb only
```

The rest are the terms of everything in the package that you did not write: the bundled Node.js, GTKX, and every npm package the bundle reaches. The deb carries them in the [machine-readable copyright format](https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/) that Debian expects, and the other targets carry the same material as a plain text file. See [Deploying](/guide/deploying#third-party-notices).

The launcher resolves the other files from its own location, so nothing is hardcoded to `/usr` and the same tree works in a Flatpak and inside an AppImage.

## Installing it

```bash
sudo apt install ./build/out/gtkx-tutorial_1.0.0-1_amd64.deb
sudo dnf install ./build/out/gtkx-tutorial-1.0.0-1.x86_64.rpm
flatpak install --user ./build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak
chmod +x build/out/Tasks-1.0.0-x86_64.AppImage && ./build/out/Tasks-1.0.0-x86_64.AppImage
```

Open the overview and type **Tasks**. The app appears with its own blue checklist icon rather than a generic placeholder, and pressing Enter launches it. Open the desktop's notification settings and Tasks is listed there as an app that sends notifications.

The deb and the rpm install no maintainer scripts. Refreshing the desktop, icon, and schema caches is left to the distribution's own triggers, which is what a well-behaved package does.

## Reviewing what was generated

```bash
npm run deploy -- --print-manifests
```

writes and validates the metadata and every target's manifest, then stops without packaging. `build/metadata/com.gtkx.tutorial.desktop` comes out as:

```ini
[Desktop Entry]
Type=Application
Name=Tasks
GenericName=Task Manager
Comment=Manage your tasks and to-dos
Exec=gtkx-tutorial
Icon=com.gtkx.tutorial
Terminal=false
Categories=Office;ProjectManagement;
Keywords=Task;Tasks;Todo;To-do;Checklist;
StartupNotify=true
StartupWMClass=com.gtkx.tutorial
DBusActivatable=true
X-GNOME-UsesNotifications=true
```

The identifiers agree because they come from one source: `Icon` is the application ID from [Your First Window](/tutorial/your-first-window), `Exec` is `binaryName`, and the metainfo's `launchable` points back at this file.

## When a tool is missing

`gtkx deploy` needs `desktop-file-validate` and `appstreamcli` for the metadata, GNU gettext for a project with `po/`, and `flatpak-builder` for the Flatpak. It lists everything missing at once, with the install line for your distribution:

```
[gtkx] error Cannot deploy: 1 required tool is missing.

  flatpak-builder           builds the Flatpak
                            sudo dnf install flatpak-builder
                            or: flatpak install --user -y flathub org.flatpak.Builder

Narrow the run with --target if you do not need every package format.
```

`nfpm` for the deb and rpm, and `appimagetool` for the AppImage, are downloaded and checksum-verified on first use, so building a `.deb` on Fedora needs nothing installed.

## Next

[Speaking the User's Language](/tutorial/internationalization) gives the interface and every package's desktop metadata one translated catalog before the Flatpak goes to Flathub.
