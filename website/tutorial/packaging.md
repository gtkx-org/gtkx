---
title: "Package and Publish Tasks"
description: "Build Tasks as a Flatpak, deb, rpm, or AppImage and prepare a Flathub submission."
---

# Package and Publish Tasks

`gtkx deploy` derives desktop metadata and package manifests from `package.json`, `gtkx.config.ts`, imported resources, schemas, and translation catalogs.

## Add the application metadata

```ts
export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    applicationIcon: "data/icons",
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office", "ProjectManagement"],
        targets: ["flatpak", "deb", "rpm", "appimage"],
    },
});
```

Place the primary icon under `data/icons/hicolor/<size>/apps/com.gtkx.tutorial.svg`. Keep the license file, screenshots, and any `extraFiles` inside the repository so source-based Flatpak builds can reach them.

Preview generated metadata before invoking packaging tools:

```bash
npm run deploy -- --print-manifests
```

Resolve every validation error at its named config key. Then build the selected artifact:

```bash
npm run deploy -- --target flatpak
```

The [Deploying guide](/guide/deploying) lists prerequisites, targets, notices, and signing options. Generated manifests live under `build/`; edit configuration rather than generated files.

## Include translations

When `po/LINGUAS` exists, deploy refreshes catalogs, compiles MO files, localizes desktop/AppStream/MIME metadata, and installs everything under `share/locale`. Run codegen before release so the POT and PO files committed to the repository match the source.

## Submit to Flathub

Set `deploy.flatpak.mode` to `"source"`. The generated manifest pins the release source and vendors package-manager dependencies for an offline sandbox build.

```bash
npm run deploy -- --target flatpak --print-manifests
```

Review the manifest, test it with `flatpak-builder`, and submit that generated shape to Flathub. Do not commit generated desktop entries, AppStream XML, or package manifests.

The complete metadata and assets are in [`examples/tutorial`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial). You now have the full GTKX loop: render native widgets, persist domain state, adapt navigation, integrate with the desktop, test user behavior, and ship a package.
