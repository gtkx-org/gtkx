---
description: "Give Tasks an icon, desktop metadata, and installable packages."
---

# Package the App

The app now has a [test suite](/tutorial/testing). Use `gtkx deploy` to package it with an icon, desktop entry, settings schema, and Node.js runtime.

## Name the release

Merge these fields into `package.json`, keeping its existing dependencies and scripts:

```json [package.json] merge
{
    "name": "gtkx-tutorial",
    "version": "1.0.0",
    "license": "MPL-2.0",
    "description": "Tasks app from the GTKX tutorial",
    "author": "GTKX <hello@gtkx.dev>",
    "homepage": "https://gtkx.dev"
}
```

Refresh the lockfile after updating the package metadata:

```bash
npm install --package-lock-only
```

Save the tutorial's [LICENSE](https://github.com/gtkx-org/gtkx/blob/v1.6.0/examples/tutorial/LICENSE) in the project root. Keep the updated lockfile; the later Flatpak source build uses it to install dependencies offline.

## Add the application icons

Copy the tutorial's [full-color icon](https://github.com/gtkx-org/gtkx/blob/v1.6.0/examples/tutorial/data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg) and [symbolic icon](https://github.com/gtkx-org/gtkx/blob/v1.6.0/examples/tutorial/data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg) into these paths:

```text
data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg
data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg
```

The configuration keeps `applicationIcon: "data/icons"`. GTKX copies this icon tree into the build and installed packages. The filenames match the application ID already used by the window and About dialog.

For your own artwork, follow the [GNOME app icon guidelines](https://developer.gnome.org/hig/guidelines/app-icons.html).

## Describe the app

Replace `gtkx.config.ts` with the complete configuration below:

```ts [gtkx.config.ts]
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    applicationIcon: "data/icons",
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
        v2TreeShaking: true,
    },
    deploy: {
        name: "Tasks",
        genericName: "Task Manager",
        binaryName: "gtkx-tutorial",
        summary: "Manage your tasks and to-dos",
        description: [
            "Tasks lets you organize to-dos into lists, set reminders, and track completed work. Built with GTKX, React, and Adwaita.",
        ],
        categories: ["Office", "ProjectManagement"],
        keywords: ["Task", "Tasks", "Todo", "To-do", "Checklist"],
        isDbusActivatable: true,
        desktopEntry: { "X-GNOME-UsesNotifications": "true" },
        targets: ["flatpak", "deb", "rpm", "appimage"],
    },
});
```

GTKX derives the version, license, author, and homepage from `package.json`. It uses this configuration to generate the desktop entry and AppStream metadata.

The notification entry gives Tasks a place in the desktop's notification settings. D-Bus activation lets notification actions reach the app when it is closed. These settings complete the [reminder](/tutorial/reminders) workflow.

The [finished configuration](https://github.com/gtkx-org/gtkx/blob/v1.6.0/examples/tutorial/gtkx.config.ts) also includes screenshots and release notes. Add those when preparing your own release; the [configuration reference](/reference/@gtkx/config/index/type-aliases/Config) describes the available options.

## Build and preview

The dev server can stay open while you build:

```bash
npm run build
node dist/bundle.mjs
```

Keep the whole `dist/` directory together. The bundle loads its native addon, compiled settings, and other assets from that directory. Running it directly still requires a compatible Node.js version, native libraries, and CPU architecture; the package command below supplies Node.js.

Preview the deployment files before packaging:

```bash
npm run deploy -- --print-manifests
```

GTKX builds the app, validates its metadata, and writes the install tree and target manifests under `build/`. Open the generated desktop entry and metainfo in `build/metadata/` and check the name, icon, description, and application ID. The command stops before creating packages.

## Create packages

Build the three formats used in this chapter:

```bash
npm run deploy -- --target appimage,deb,rpm
```

The artifacts appear in `build/out/`. GTKX downloads and verifies the required packaging tools and Node.js runtime, then caches them. It also includes the app's license and notices for bundled dependencies. The [deploying guide](/guide/deploying) explains the runtime and packaging requirements.

Choose the package appropriate for your machine. For an x64 build, use one of:

```bash
sudo apt install ./build/out/gtkx-tutorial_1.0.0-1_amd64.deb
```

```bash
sudo dnf install ./build/out/gtkx-tutorial-1.0.0-1.x86_64.rpm
```

Or run the AppImage:

```bash
chmod +x build/out/Tasks-1.0.0-x86_64.AppImage
./build/out/Tasks-1.0.0-x86_64.AppImage
```

If deployment reports missing tools, follow its installation instructions or select fewer targets. Packaging a deb or rpm does not require running the corresponding distribution.

## Run it

For an installed package, find **Tasks** in the application launcher and confirm its icon appears. Open it, add a task, quit, and reopen it to check persistence. Check that Tasks appears in the desktop's notification settings.

## Next

[Translate the App](/tutorial/internationalization) adds a French catalog to the interface and package metadata. The last chapter builds the Flatpak.
