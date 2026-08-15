---
description: "Install the Flatpak you built, see which sandbox permissions the app does not need, and submit it to Flathub."
---

# Appendix C: Shipping It on Flathub

[Appendix B](/tutorial/packaging) built the packages. This page is about one of them.

A Flatpak bundles the app with a pinned platform, so it sees the same Adwaita it was built against on any distribution. The finished app runs in a sandbox, and the permissions it asks for are the part worth planning.

## Build and install it

```bash
npm run deploy -- --target flatpak
```

```
[gtkx] Deploying Tasks 1.0.0-1 as gtkx-tutorial (x86_64) to flatpak
[gtkx] Validated the desktop entry and the metainfo
[gtkx] Building ~/tasks/src/index.tsx
[gtkx] Bundled Node.js v24.19.0 (100.8 MiB, glibc >= 2.28)
[gtkx] Staged 12 files into build/stage
[gtkx] Wrote build/targets/flatpak/com.gtkx.tutorial.yml
[gtkx] flatpak: running flatpak-builder, this can take several minutes
[gtkx] Built build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak (31.2 MiB)
```

`--install-deps-from=flathub` pulls the GNOME runtime the first time, which is slow and then cached. Install and launch:

```bash
flatpak install --user build/out/com.gtkx.tutorial-1.0.0-x86_64.flatpak
flatpak run com.gtkx.tutorial
```

Tasks opens as a fresh install with its own data directory, so the seeded lists and tasks appear as they did on your first run. Add a task called `Ship it`, then quit and check where it landed:

```bash
cat ~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial/tasks.json
```

The task is there. Check that your everyday copy of the app is untouched:

```bash
ls ~/.local/share/com.gtkx.tutorial/
```

That directory still holds the tasks you added throughout this tutorial, with no `Ship it` among them. The stores are independent, share one storage backend, and need no branch anywhere in your code.

## What the sandbox does not grant

The generated manifest asks for these permissions, and you can replace them with `deploy.flatpak.finishArgs`:

```yaml
finish-args:
  - --share=ipc
  - --socket=wayland
  - --socket=fallback-x11
  - --device=dri
```

Those grant a window on screen and hardware rendering. There is no `--filesystem`, no `--share=network`, and no `--talk-name` for the notification service. Tasks reads and writes your data, sends desktop notifications, and stores preferences with none of those.

**No filesystem permission**, thanks to a decision from [Saving Tasks Between Runs](/tutorial/saving-to-disk). The storage backend resolves its directory from `XDG_DATA_HOME`, which Flatpak sets to the app's private directory before the process starts. The code that found `~/.local/share/com.gtkx.tutorial` on your machine finds `~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial` inside the sandbox, unchanged. A hardcoded path, or one built from `homedir()` alone, would need `--filesystem=home`, and Flathub reviewers would ask why.

**No notification permission**, because `Gio.Notification` goes through a portal. The reminder from [Reminders That Reach the Desktop](/tutorial/reminders) is handed to the application, and inside a sandbox that call routes to the notification portal instead of a raw D-Bus name. The portal asks the user, keeps the permission revocable in system settings, and delivers **Mark Complete** back to your `app.complete-task` action.

**No network permission**, because the app never opens a socket. Everything it knows lives in one JSON file and one GSettings schema.

Permissions are the one part of packaging that stays a deliberate decision, which is why `finishArgs` is hand-authored rather than derived. A short list backed by portals is the quickest thing for a reviewer to approve.

## The modes

What you just built uses `deploy.flatpak.mode: "prebuilt"`, the default. It copies the tree `gtkx deploy` staged into the sandbox, which needs no network inside the build and takes seconds.

Flathub does not accept that. Its submission rules require that an app is built entirely from source, and that no binary or precompiled files appear in the pull request. So `gtkx deploy` has a second mode that emits a manifest which builds the app inside the sandbox:

```ts
deploy: {
    flatpak: { mode: "source" },
},
```

`source` mode changes what the manifest carries. The module's source becomes a `git` source pinned to your release rather than your working tree. It adds the `org.freedesktop.Sdk.Extension.node24` SDK extension, since the GNOME SDK carries no Node.js and the sandbox now has to run the build. It vendors every npm dependency ahead of time with [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node), because the build sandbox has no network and `npm ci --offline` has to resolve from a local cache. And it carries the generated desktop entry, metainfo, and launcher as inline sources, so nothing generated has to be committed to your repository.

Install the generator once:

```bash
pipx install git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node
```

Then produce the manifest without building anything:

```bash
npm run deploy -- --target flatpak --print-manifests
```

That writes `build/targets/flatpak/com.gtkx.tutorial.yml` and `generated-sources.json`, which are the files a submission needs.

## Submitting

The URL, tag, and commit come from your `origin` remote and the tag you are on, and `deploy.flatpak.source` overrides any of them:

```ts
flatpak: {
    mode: "source",
    source: { url: "https://github.com/you/your-app.git", tag: "v1.0.0" },
},
```

A tag on its own is enough, as long as it exists in your checkout: Flathub builds a fixed tree rather than following a movable tag, so `gtkx deploy` resolves the tag to its commit and writes both into the manifest.

Commit `package.json` and your lockfile so the offline install resolves, tag the release, and push.

The pull request goes to [flathub/flathub](https://github.com/flathub/flathub), against the `new-pr` branch, carrying the manifest named after your application ID and `generated-sources.json` beside it. Before opening it, check the manifest the way Flathub's own CI does:

```bash
flatpak install --user -y flathub org.flatpak.Builder
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest \
    build/targets/flatpak/com.gtkx.tutorial.yml
```

A reviewer reads your `finish-args` first. Rerun `--print-manifests` on every dependency change: a stale `generated-sources.json` only fails inside the sandbox.

## Next

Read the [complete source on GitHub](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial), or the [deploying guide](/guide/deploying) for the full `deploy` reference, then start your own with `npm create gtkx`.
