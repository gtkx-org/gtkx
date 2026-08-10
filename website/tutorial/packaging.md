---
description: "Give the finished app an icon, a desktop entry, AppStream metadata, and a single executable."
---

# Appendix B: Making It a Real Application

[Appendix A](/tutorial/testing) left you with a test suite. Nothing here changes what the app does. This appendix closes the gap between an app that runs from your project directory and one that installs, appears in the overview under its own icon, and carries the metadata a software center expects.

## What the build produces

Leave the dev server running. `gtkx build` writes to `dist/`, which the dev server never reads, so the two coexist.

```bash
npm run build
```

```
> tasks@0.0.1 build
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
dist/gtkx.node                                                   1,624.69 kB
dist/bundle.js                                                   4,067.30 kB │ gzip: 510.94 kB

✓ built in 694ms
[gtkx] Build complete: dist/bundle.js
```

Everything except the bundle is found at runtime relative to the executable: the bundle prepends its own directory to `GSETTINGS_SCHEMA_DIR` and `XDG_DATA_DIRS`, and loads `gtkx.node` from beside `process.execPath`. Keep them together and the app is self-contained. Move `bundle.js` on its own and the settings schema goes missing on the first `useSetting` call.

`node dist/bundle.js` runs the app on any machine with GTK4 and Adwaita installed. That works, but it is not yet something a user can double-click.

## A single executable

Node.js can embed a script into a copy of the `node` binary as a [Single Executable Application](https://nodejs.org/api/single-executable-applications.html), giving one file that needs no `node` on the target machine. Three scripts do the work, and the two tools they call are needed only at build time:

```bash
npm install -D esbuild postject
```

```json
"scripts": {
  "bundle": "gtkx build && node scripts/bundle.ts",
  "bundle:postject": "node scripts/bundle-postject.ts",
  "build:sea": "bash scripts/build-sea.sh"
}
```

`bundle` re-emits the app as CommonJS with esbuild, because a single executable cannot use ESM, and swaps the native addon for a shim that loads `gtkx.node` from beside `process.execPath`. `bundle:postject` vendors the `postject` CLI into `vendor/postject.cjs` as one self-contained file, so the injection step works offline. `build:sea` generates the blob, copies the `node` binary, and injects the blob into the copy. All three are in [`examples/tutorial/scripts/`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/scripts), ready to copy into your own project.

`sea-config.json` tells Node.js what to embed:

```json
{
    "main": "dist/bundle.cjs",
    "output": "dist/sea-prep.blob",
    "disableExperimentalSEAWarning": true,
    "useCodeCache": true
}
```

Run them in order:

```bash
npm run bundle && npm run bundle:postject && npm run build:sea
```

The last step ends with:

```
SEA build complete!
  Binary: dist/app
  Native: dist/gtkx.node

To run: ./dist/app
```

## The desktop entry

A desktop entry makes the app something the desktop knows about, not a path you type. It is an INI file whose name matches the application ID.

Create `flatpak/com.gtkx.tutorial.desktop`:

```ini
[Desktop Entry]
Name=Tasks
GenericName=Task Manager
Comment=Manage your tasks and to-dos
Exec=gtkx-tutorial
Icon=com.gtkx.tutorial
Terminal=false
Type=Application
Categories=Office;ProjectManagement;
Keywords=Task;Tasks;Todo;To-do;Checklist;
StartupNotify=true
X-GNOME-UsesNotifications=true
DBusActivatable=true
```

`Exec` is the command, so the binary has to be installed under that name and on `PATH`. `Icon` is the application ID, which is how it resolves against the icon theme. `Categories` decides where the app appears in a launcher that groups by category, and `Keywords` adds search terms beyond the name.

`X-GNOME-UsesNotifications=true` gives the app its own row in the desktop's notification settings, so the reminders from [Reminders That Reach the Desktop](/tutorial/reminders) can be tuned or silenced there. `DBusActivatable=true` lets the desktop start the app over D-Bus instead of running `Exec` directly. That is how a reminder's **Mark Complete** button reaches the `app.complete-task` action when the app is closed: the desktop activates the application by its ID, delivers the action, and the app handles it on startup.

## Icons

The build copies `data/icons/` verbatim, so the layout you write is the layout that ships. Use the same shape as the system icon theme:

```
data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg
data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg
```

`hicolor` is the fallback theme every icon theme inherits from, `scalable` is where SVGs go, and `apps` is the context. The file name is the application ID, which both the desktop entry's `Icon` key and the About dialog's `applicationIcon` prop look up. Since the tree already matches the theme, installing it is a plain recursive copy into a share directory.

The full-color icon is a 128 by 128 SVG. The symbolic variant is a separate 16 by 16 drawing in a single flat fill, so the desktop can recolor it for a dark header bar or a notification badge.

`data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg height="16px" viewBox="0 0 16 16" width="16px" xmlns="http://www.w3.org/2000/svg">
    <path d="m 5 1 c -2.216 0 -4 1.784 -4 4 v 6 c 0 2.216 1.784 4 4 4 h 6 c 2.216 0 4 -1.784 4 -4 v -6 c 0 -2.216 -1.784 -4 -4 -4 z m 0 2 h 6 c 1.108 0 2 0.892 2 2 v 6 c 0 1.108 -0.892 2 -2 2 h -6 c -1.108 0 -2 -0.892 -2 -2 v -6 c 0 -1.108 0.892 -2 2 -2 z" fill="#241f31"/>
    <path d="m 4.5 8.5 l 2.5 2.5 l 5.5 -5.5 l -1.5 -1.5 l -4 4 l -1 -1 z" fill="#241f31"/>
</svg>
```

## AppStream metadata

A software center needs more than a name and an icon. The rest lives in an AppStream metainfo file, which is also what Flathub validates on submission.

Create `flatpak/com.gtkx.tutorial.metainfo.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
    <id>com.gtkx.tutorial</id>
    <name>Tasks</name>
    <summary>Manage your tasks and to-dos</summary>
    <metadata_license>CC0-1.0</metadata_license>
    <project_license>MPL-2.0</project_license>
    <developer id="dev.gtkx">
        <name>GTKX</name>
    </developer>
    <description>
        <p>
            A task manager built with GTKX, demonstrating how to build React-based
            GTK4 and Adwaita desktop applications. It shows an adaptive sidebar
            layout, boxed lists, a task editor, GSettings-backed preferences, undo
            toasts, drag-to-reorder, desktop notifications, and local JSON
            persistence.
        </p>
    </description>
    <launchable type="desktop-id">com.gtkx.tutorial.desktop</launchable>
    <url type="homepage">https://gtkx.dev</url>
    <url type="bugtracker">https://github.com/gtkx-org/gtkx/issues</url>
    <url type="vcs-browser">https://github.com/gtkx-org/gtkx</url>
    <provides>
        <binary>gtkx-tutorial</binary>
    </provides>
    <screenshots>
        <screenshot type="default">
            <image>https://raw.githubusercontent.com/gtkx-org/gtkx/main/examples/tutorial/assets/screenshot.png</image>
            <caption>Browsing task lists in the sidebar</caption>
        </screenshot>
        <screenshot>
            <image>https://raw.githubusercontent.com/gtkx-org/gtkx/main/examples/tutorial/assets/screenshot-editor.png</image>
            <caption>Editing a task</caption>
        </screenshot>
    </screenshots>
    <releases>
        <release version="1.0.0" date="2026-07-13">
            <description>
                <p>Initial release.</p>
            </description>
        </release>
    </releases>
    <content_rating type="oars-1.1" />
    <branding>
        <color type="primary" scheme_preference="light">#3584e4</color>
        <color type="primary" scheme_preference="dark">#1a5fb4</color>
    </branding>
</component>
```

The identifiers have to agree: `id` is the application ID you set in `gtkx.config.ts`, `launchable` names the desktop entry file, and `provides`/`binary` names the command in `Exec`. `metadata_license` covers this XML file, `project_license` covers the app. A software center fetches screenshot images over the network, so they need public URLs rather than local paths. `branding` gives a software center accent colors to theme the listing with.

Both files have validators, wired up as one script:

```bash
npm run flatpak:lint
```

That runs `desktop-file-validate` on the entry and `appstreamcli validate --no-net` on the metainfo. Fix what they report before installing anything: the desktop silently ignores a malformed entry, so the app never shows up.

## Installing into a user prefix

`~/.local` is the per-user counterpart of `/usr`, and the desktop searches it by default. Install the binary and its neighbors into `~/.local/bin`, and the metadata into `~/.local/share`:

```bash
install -Dm755 dist/app ~/.local/bin/gtkx-tutorial
install -Dm755 dist/gtkx.node ~/.local/bin/gtkx.node
install -Dm644 dist/gschemas.compiled ~/.local/bin/gschemas.compiled
install -Dm644 flatpak/com.gtkx.tutorial.desktop ~/.local/share/applications/com.gtkx.tutorial.desktop
install -Dm644 flatpak/com.gtkx.tutorial.metainfo.xml ~/.local/share/metainfo/com.gtkx.tutorial.metainfo.xml
cp -r data/icons/hicolor ~/.local/share/icons/
update-desktop-database ~/.local/share/applications
gtk4-update-icon-cache -f -t ~/.local/share/icons/hicolor
```

The binary, the native addon, and the compiled schema share a directory because that is where the running executable looks for them. The cache commands tell the desktop to notice the new files immediately rather than at the next login.

## Run it

Run `./dist/app` from the project directory. Tasks opens with your seeded lists, and closing and reopening it shows the same tasks, because the store still reads and writes `XDG_DATA_HOME` exactly as it did under `npm run dev`.

Then install with the commands above, open the overview, and type **Tasks**. The app appears with its own blue checklist icon rather than a generic placeholder, and pressing Enter launches it. Open the desktop's notification settings and Tasks is listed there as an app that sends notifications.

For the negative check, move `dist/gschemas.compiled` out of `~/.local/bin` and launch again from a terminal. The app aborts on the first settings read with a GLib error naming the `com.gtkx.tutorial` schema as not installed. Put the file back and it starts.

## Next

Appendix C builds this same set of files into a sandboxed, distributable package: [Shipping It on Flathub](/tutorial/flatpak).
