---
description: "Build Flatpak, deb, rpm and AppImage packages from the app's metadata."
---

# Package the App

Describe the app in `gtkx.config.ts`, add its icons and screenshots, and build Flatpak, deb, rpm and AppImage packages.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Application metadata

The scaffold's `deploy` block holds placeholders. Replace it with the name, summary, description, categories, developer, links, screenshots, releases and branding that the desktop entry and AppStream metadata need. `isDbusActivatable` lets the desktop start Notes over D-Bus, and `targets` picks the package formats. See [Configure your application](/v2/guide/deploying#configure-your-application).

<<< @/figures/tutorial/packaging/gtkx.config.ts [gtkx.config.ts]

The version and license come from `package.json`. The release in `releases` matches its `version`:

<<< @/figures/tutorial/packaging/package.json{3,5} [package.json]

Opening Notes from the launcher while it runs activates the running instance instead of starting a second one. Present its window there, as [The application element](/v2/guide/application-lifecycle#the-application-element) explains:

<<< @/figures/tutorial/packaging/src/app.tsx{10-12} [src/app.tsx]

The next `npm run deploy` adds the desktop entry and AppStream text to the catalogs in `po/`. Translate them as in [Translate the App](/v2/tutorial/internationalization#add-a-translation); see [Translate package metadata](/v2/guide/internationalization#translate-package-metadata).

## Icons and screenshots

`applicationIcon: "data/icons"` is an icon theme directory that GTKX copies into every package. Replace the scaffold's placeholder with the Notes icon and add its symbolic variant, both from the finished app's [`data/icons`](https://github.com/gtkx-org/gtkx/tree/main/tutorial/data/icons):

```text
data/icons/hicolor/scalable/apps/dev.gtkx.Notes.svg
data/icons/hicolor/symbolic/apps/dev.gtkx.Notes-symbolic.svg
```

The About dialog shows the icon, named after the application ID, and the version from `package.json`:

<<< @/figures/tutorial/packaging/src/components/about.tsx{4-5,11-12} [src/components/about.tsx]

`deploy.screenshots` lists the PNGs in [`assets/`](https://github.com/gtkx-org/gtkx/tree/main/tutorial/assets). Software centers download them from `screenshotBaseUrl`, so push them before you publish a package.

## Build the packages

Preview the metadata first. The command validates the desktop entry and AppStream metadata, writes them to `build/<arch>/metadata/`, and stops before creating packages:

```bash
npm run deploy -- --print-manifests
```

`npm run deploy` builds each target in `targets` into `build/out`. The Flatpak can't reach the notes folder until [Prepare for Flathub](/v2/tutorial/flatpak) grants it, so build the other formats here:

```bash
npm run deploy -- --target deb,rpm,appimage
```

The command lists any missing tool with an installation hint; see [Build tools](/v2/guide/deploying#build-tools).

## Run it

Install the `.deb` or `.rpm` with your package manager, or run the `.AppImage`. Notes appears in the launcher with its icon. Open the main menu and choose **About Notes**.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-packaging-light.png" width="720" height="480" loading="lazy" alt="The Notes window with the About dialog open: the yellow Notes icon with a Markdown heading mark, the name Notes, the developer GTKX, the version 1.0.0, and Details and Report an Issue rows." />
    <img class="result-dark" src="/figures/tutorial-packaging-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with the About dialog open in the dark style: the yellow Notes icon with a Markdown heading mark, the name Notes, the developer GTKX, the version 1.0.0, and Details and Report an Issue rows." />
    <figcaption>Captured from <a href="#icons-and-screenshots"><code>src/components/about.tsx</code></a> above, after choosing About Notes.</figcaption>
</figure>
