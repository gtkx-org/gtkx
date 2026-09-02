---
description: "Install the Flatpak you built, see which sandbox permissions the app does not need, and submit it to Flathub."
---

# Appendix C: Shipping It on Flathub

[Speaking the User's Language](/v2/tutorial/internationalization) rebuilt every package with its French catalog and metadata. This page takes the Flatpak into its sandbox and then prepares the source-mode manifest Flathub needs.

A Flatpak bundles the app with a pinned platform, so it sees the same Adwaita it was built against on any distribution. The finished app runs in a sandbox, and the permissions it asks for are the part worth planning.

## Build and install it

```bash
npm run deploy -- --target flatpak
```

```
[gtkx] Deploying Tasks 1.0.0-1 as gtkx-tutorial (x86_64) to flatpak
[gtkx] Building ~/tasks/src/index.tsx
[gtkx] Validated the desktop entry and the metainfo
[gtkx] Bundled Node.js v26.7.0 (109.4 MiB, glibc >= 2.28)
[gtkx] Staged 11 files into build/stage
[gtkx] Wrote build/targets/flatpak/com.gtkx.tutorial.yml
[gtkx] flatpak: running flatpak-builder, this can take several minutes
[gtkx] Built build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak (26.4 MiB)
```

`--install-deps-from=flathub` pulls the GNOME runtime the first time, which is slow and then cached. Install and launch:

```bash
flatpak install --user --reinstall build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak
flatpak run --env=LANG=fr_FR.UTF-8 --env=LANGUAGE=fr com.gtkx.tutorial
```

Tasks opens as a fresh install with its own data directory and reads the catalog installed at `/app/share/locale`, so its first-run lists and tasks appear in French. Add a task called `Ship it`, then quit and check where it landed:

```bash
cat ~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial/tasks.json
```

The task is there. Check that your everyday copy of the app is untouched:

```bash
ls ~/.local/share/com.gtkx.tutorial/
```

That directory still holds the tasks you added throughout this tutorial, with no `Ship it` among them. The stores are independent, share one storage backend, and need no branch anywhere in your code.

## What the sandbox does not grant

The generated manifest asks for these permissions, and `deploy.flatpak.finishArgs` adds to them:

```yaml
finish-args:
  - --share=ipc
  - --socket=wayland
  - --socket=fallback-x11
  - --device=dri
```

Those grant a window on screen and hardware rendering. There is no `--filesystem`, no `--share=network`, and no `--talk-name` for the notification service. Tasks reads and writes your data, sends desktop notifications, and stores preferences with none of those.

**No filesystem permission**, thanks to a decision from [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk). The storage backend resolves its directory from `XDG_DATA_HOME`, which Flatpak sets to the app's private directory before the process starts. The code that found `~/.local/share/com.gtkx.tutorial` on your machine finds `~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial` inside the sandbox, unchanged. A hardcoded path, or one built from `homedir()` alone, would need `--filesystem=home`, and Flathub reviewers would ask why.

**No notification permission**, because `Gio.Notification` goes through a portal. The reminder from [Reminders That Reach the Desktop](/v2/tutorial/reminders) is handed to the application, and inside a sandbox that call routes to the notification portal instead of a raw D-Bus name. The portal asks the user, keeps the permission revocable in system settings, and delivers **Mark Complete** back to your `app.complete-task` action.

**No network permission**, because the app never opens a socket. Everything it knows lives in one JSON file and one GSettings schema.

Permissions are the one part of packaging that stays a deliberate decision, which is why anything beyond that baseline is hand-authored rather than derived. A short list backed by portals is the quickest thing for a reviewer to approve.

## The modes

What you just built uses `deploy.flatpak.mode: "prebuilt"`, the default. It copies the tree `gtkx deploy` staged into the sandbox, which needs no network inside the build and takes seconds.

Flathub does not accept that. Its submission rules require that an app is built entirely from source, and that no binary or precompiled files appear in the pull request. So `gtkx deploy` has a second mode that emits a manifest which builds the app inside the sandbox:

```ts
deploy: {
    flatpak: {
        mode: "source",
        source: { url: "https://github.com/you/tasks.git" },
    },
},
```

Replace that URL with the public HTTPS repository you will push. `source` mode changes what the manifest carries. The module's source becomes a `git` source pinned to your current commit rather than your working tree. It adds the `org.freedesktop.Sdk.Extension.node26` SDK extension, since the GNOME SDK carries no Node.js and the sandbox now has to run the build. It vendors every npm dependency ahead of time with [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node), because the build sandbox has no network and `npm ci --offline` has to resolve from a local cache. And it carries the localized desktop entry, metainfo, and launcher as inline sources, so those generated files do not have to be committed to your repository. The sandbox build compiles the committed `po/fr.po`, then copies `dist/locale` into `/app/share/locale` with the bundle.

Install the generator once:

```bash
pipx install git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node
```

The source commit must contain the source-mode setting, lockfile, and catalogs. Commit the release tree first:

```bash
git add .
git commit -m "Prepare source release"
```

Then produce the manifest without building the Flatpak package:

```bash
npm run deploy -- --target flatpak --print-manifests
```

That writes `build/targets/flatpak/com.gtkx.tutorial.yml` and `generated-sources.json`, which are the files a submission needs.

## Submitting

The manifest takes the URL you configured and pins the current `HEAD` commit automatically. You can also pin an existing release tag explicitly:

```ts
flatpak: {
    mode: "source",
    source: { url: "https://github.com/you/tasks.git", tag: "v1.0.0" },
},
```

A tag must already exist in your checkout. Flathub builds a fixed tree rather than following a movable tag, so `gtkx deploy` resolves it to its commit and writes both into the manifest.

The earlier localization preview already refreshed the source and metadata messages. Confirm that `package.json`, the lockfile, `po/LINGUAS`, `po/fr.po`, `po/com.gtkx.tutorial.pot`, and `po/POTFILES.in` are in the commit, then tag the release and push. If you add `tag` to the config, create the tag before rerunning the final manifest preview. MO files stay out of the repository; `gtkx build` reproduces them inside the sandbox.

The pull request goes to [flathub/flathub](https://github.com/flathub/flathub), against the `new-pr` branch, carrying the manifest named after your application ID and `generated-sources.json` beside it. Before opening it, check the manifest the way Flathub's own CI does:

```bash
flatpak install --user -y flathub org.flatpak.Builder
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest \
    build/targets/flatpak/com.gtkx.tutorial.yml
```

A reviewer reads your `finish-args` first. Rerun `--print-manifests` on every dependency change: a stale `generated-sources.json` only fails inside the sandbox.

## Next

Read the [complete source on GitHub](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial), or the [deploying guide](/v2/guide/deploying) for the full `deploy` reference, then start your own with `npm create gtkx@beta`.
