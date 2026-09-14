---
description: "Build a Flatpak for Tasks and prepare a source manifest for distribution."
---

# Appendix C: Shipping It on Flathub

The [localization chapter](/v2/tutorial/internationalization) added a French catalog. Package it in a Flatpak, then use GTKX's source mode to prepare a manifest that rebuilds the application.

## Build and install it

```bash
npm run deploy -- --target flatpak
```

GTKX writes the manifest under `build/<arch>/targets/flatpak/` and runs Flatpak Builder. The first build downloads its GNOME runtime from Flathub. Install the resulting x64 bundle and launch it in French:

```bash
flatpak install --user --reinstall build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak
flatpak run --env=LANG=fr_FR.UTF-8 --env=LANGUAGE=fr --env=LC_ALL=fr_FR.UTF-8 com.gtkx.tutorial
```

Use the artifact matching your architecture. Tasks loads the installed catalog from `/app/share/locale`. On a fresh Flatpak installation, its initial lists and tasks are created in French.

## Check storage and reminders

Add a task named `Ship it`, quit, and reopen the Flatpak. Confirm the task persists. The storage backend from [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk) uses GLib's data directory, which points into the Flatpak's private storage:

```bash
cat ~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial/tasks.json
```

The development app keeps its existing data under `~/.local/share/com.gtkx.tutorial/`. Both use the same GTKX application code.

Also check preferences and a reminder's **Mark Complete** action. Tasks uses the generated display and rendering permissions without adding filesystem or network access. For another application, `deploy.flatpak.finishArgs` configures additional permissions; consult the [Flatpak sandbox documentation](https://docs.flatpak.org/en/latest/sandbox-permissions.html).

## Generate a source manifest

The default `prebuilt` mode packages the local build. In `source` mode, the manifest checks out a pinned Git revision, installs dependencies offline, and runs `gtkx build` inside the SDK.

Add this setting inside the existing `deploy` block:

```ts
flatpak: {
    mode: "source",
    source: { url: "https://github.com/you/tasks.git" },
},
```

Use your application's public repository URL. Install [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node) using its installation instructions; GTKX uses it to prepare the offline dependency sources.

Commit the configuration, application sources, lockfile, icons, license, and translation catalogs. Generated MO files stay out of Git; the build reproduces them. Then generate the manifest:

```bash
npm run deploy -- --target flatpak --print-manifests
```

Keep `com.gtkx.tutorial.yml` and `generated-sources.json` together in `build/<arch>/targets/flatpak/`. Regenerate them after dependency changes. The manifest includes the Node.js SDK extension and installs the bundle, icons, settings, and compiled catalogs.

GTKX pins the current commit. To select a release tag instead, create and push that tag, then set `source.tag: "v1.0.0"` before regenerating. GTKX resolves the tag to a commit in your checkout.

## Prepare your own submission

Use your application's identity and metadata before publishing. The generated source manifest is a starting point: it rebuilds the application bundle, while native npm dependencies still use their packaged binaries. Review those dependencies against [Flathub's source-build requirements](https://docs.flathub.org/docs/for-app-authors/requirements#building-from-source) before submission.

Build and test the final source manifest using [Flathub's submission instructions](https://docs.flathub.org/docs/for-app-authors/submission), including its manifest and repository checks. GTKX's manifest preview does not run that build or establish submission readiness.

## Next

Browse the [complete tutorial source](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial), or start your own application with `npm create gtkx@beta`.
