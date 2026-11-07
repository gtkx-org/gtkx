---
description: "Build Flatpak, deb, rpm and AppImage packages from the app's metadata."
---

# Package the App

Describe the app in `gtkx.config.ts`, add its icons and screenshots, and build Flatpak, deb, rpm and AppImage packages.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Application metadata

The `deploy` block supplies the name, summary, description, categories, releases and branding for the desktop entry and AppStream metadata. See [Deploying](/v2/guide/deploying).

## Icons and screenshots

`data/icons` holds the app icon and its symbolic variant, and `assets/` the AppStream screenshots.

## Build the packages

`npm run deploy` builds each target in `targets`.

## Run it

What to check in the running app.
