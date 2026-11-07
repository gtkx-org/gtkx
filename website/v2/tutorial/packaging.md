---
description: "Describe Notes for launchers and software centers, give it an icon, and build deb, rpm and AppImage packages."
---

# Package the App

Describe Notes for launchers and software centers, give it an icon, and build packages that install it like any other desktop app.

A Linux desktop learns about an installed app from two files: a [desktop entry](https://specifications.freedesktop.org/desktop-entry-spec/latest/), which launchers read for the app's name, icon and command, and [AppStream metadata](https://www.freedesktop.org/software/appstream/docs/chap-Metadata.html), which software centers read for its description, screenshots and releases. `gtkx deploy` generates both from `gtkx.config.ts` and `package.json`, validates them, and packages them with the build. [Deploying](/v2/guide/deploying) covers every target and option.

## Application metadata

The scaffold's `deploy` block holds placeholders. Replace it with Notes' own metadata:

<<< @/figures/tutorial/packaging/gtkx.config.ts{44-45} [gtkx.config.ts]

`name`, `genericName`, `summary`, `keywords` and `categories` go into the desktop entry; the categories come from the freedesktop [category registry](https://specifications.freedesktop.org/menu-spec/latest/category-registry.html). The description paragraphs, `urls`, `screenshots`, `releases` and the `branding` colors are for software centers. List each new version in `releases`, newest first, with its notes. Without the list, GTKX writes a single release for the current version, dated the day of the build.

`isDbusActivatable` makes the launcher start Notes through the session bus instead of running its command, and GTKX installs the D-Bus service file this needs. `targets` lists the formats `npm run deploy` builds. The RPM package already requires GtkSourceView's shared library, which RPM resolves to whichever package ships it. A Debian package can depend only on package names, so `depends.deb` names the one that ships the library. Without it, the `.deb` installs on a system that lacks GtkSourceView and Notes fails to start; see [Runtime and library requirements](/v2/guide/deploying#runtime-and-library-requirements).

GTKX takes the version, license and homepage from `package.json`, and the developer from `author`, which the scaffold set to your Git `user.name`. Set the others there:

```json [package.json]
{
    "version": "1.0.0",
    "license": "MPL-2.0",
    "homepage": "https://gtkx.dev"
}
```

Notes runs as a single instance: opening it from the launcher while it runs activates the running instance instead of starting a second one. Present the window there, or the launcher appears to do nothing, as [The application element](/v2/guide/application-lifecycle#the-application-element) explains:

<<< @/figures/tutorial/packaging/src/app.tsx{10-12} [src/app.tsx]

Notes is translated, so its metadata needs French text too. The next `npm run deploy` adds the name, summary, description, keywords, screenshot captions and release notes to the template and to `po/fr.po`. Translate them as in [Translate the App](/v2/tutorial/internationalization#add-a-translation), and the packages carry them in both the desktop entry and the AppStream metadata; see [Translate package metadata](/v2/guide/internationalization#translate-package-metadata).

## Icons and screenshots

`applicationIcon: "data/icons"` points at an icon theme directory. GTKX adds it to the icon theme under `npm run dev` and installs it with every package, so the desktop finds the icon by the application ID. Replace the scaffold's placeholder with the Notes icon and add its symbolic variant, both from the finished app's [`data/icons`](https://github.com/gtkx-org/gtkx/tree/main/tutorial/data/icons); the GNOME HIG describes both kinds of [app icon](https://developer.gnome.org/hig/guidelines/app-icons.html):

```text
data/icons/hicolor/scalable/apps/dev.gtkx.Notes.svg
data/icons/hicolor/symbolic/apps/dev.gtkx.Notes-symbolic.svg
```

The About dialog shows the icon and the version. `virtual:gtkx-config` is a module GTKX generates from `gtkx.config.ts`, and its `applicationId` names the icon; the version is read from `package.json`:

<<< @/figures/tutorial/packaging/src/components/about.tsx{4-5,11-12} [src/components/about.tsx]

`screenshots` lists the PNGs in [`assets/`](https://github.com/gtkx-org/gtkx/tree/main/tutorial/assets). Software centers download each one over the network, so the metadata gives its URL: the file's path under `screenshotBaseUrl`. Without `screenshotBaseUrl`, GTKX builds the URL from the project's GitHub or GitLab remote and default branch; Notes points at the copies in the GTKX repository. Push the screenshots before you publish a package.

## Build the packages

Preview the metadata first. The command builds the app, validates the desktop entry and AppStream metadata, writes them to `build/<arch>/metadata/` and the package manifests to `build/<arch>/targets/`, and stops before creating packages:

```bash
npm run deploy -- --print-manifests
```

An excerpt of the generated desktop entry shows where the values went. The command, `gtkx-notes`, is the `name` in `package.json`:

```ini [build/x64/metadata/dev.gtkx.Notes.desktop]
[Desktop Entry]
Type=Application
Name=Notes
GenericName=Markdown Notes
Comment=Write Markdown notes kept as plain files
Exec=gtkx-notes
Icon=dev.gtkx.Notes
Categories=Utility;TextEditor;
Keywords=Notes;Markdown;Notebook;Writing;
DBusActivatable=true
```

`npm run deploy` builds each target in `targets` into `build/out`. The Flatpak can't reach the notes folder until [Prepare for Flathub](/v2/tutorial/flatpak) grants it, so build the other formats now:

```bash
npm run deploy -- --target deb,rpm,appimage
```

The first run downloads the Node.js runtime that the packages bundle and the packaging tools. The command reports any missing system tool with an installation hint; see [Build tools](/v2/guide/deploying#build-tools).

## Run it

Install the package for your distribution, on Fedora with `sudo dnf install ./build/out/*.rpm` and on Debian or Ubuntu with `sudo apt install ./build/out/*.deb`. Notes appears in the launcher with its icon. The package is named `gtkx-notes`, which is also what you remove later. The AppImage runs without installing:

```bash
./build/out/Notes-*.AppImage
```

Open the main menu and choose **About Notes**.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-packaging-light.png" width="720" height="480" loading="lazy" alt="The Notes window with the About dialog open: the yellow Notes icon with a Markdown heading mark, the name Notes, the developer GTKX, the version 1.0.0, and Details and Report an Issue rows." />
    <img class="result-dark" src="/figures/tutorial-packaging-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with the About dialog open in the dark style: the yellow Notes icon with a Markdown heading mark, the name Notes, the developer GTKX, the version 1.0.0, and Details and Report an Issue rows." />
    <figcaption>Captured from <a href="#icons-and-screenshots"><code>src/components/about.tsx</code></a> above, after choosing About Notes.</figcaption>
</figure>
