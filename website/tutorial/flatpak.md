---
description: "Build a Flatpak anyone can install, and see which sandbox permissions the app does not need."
---

# Appendix C: Shipping It on Flathub

[Appendix B](/tutorial/packaging) built a single executable that runs on your machine. This page builds one that runs on anyone's.

A Flatpak bundles the app with a pinned platform, so it sees the same Adwaita it was built against on any distribution. The build runs inside a sandbox with no network, which is the part worth planning for. The finished app runs in a sandbox too.

## The manifest

Flatpak needs one YAML file. Create `flatpak/com.gtkx.tutorial.yaml`:

```yaml
id: com.gtkx.tutorial
runtime: org.gnome.Platform
runtime-version: "50"
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.node24
command: gtkx-tutorial
finish-args:
  - --share=ipc
  - --socket=fallback-x11
  - --socket=wayland
  - --device=dri

build-options:
  append-path: /usr/lib/sdk/node24/bin
  env:
    npm_config_nodedir: /usr/lib/sdk/node24
  no-debuginfo: true
  strip: false

modules:
  - name: gtkx-tutorial
    buildsystem: simple
    build-options:
      env:
        npm_config_offline: "true"
        npm_config_cache: /run/build/gtkx-tutorial/flatpak-node/npm-cache
        XDG_CACHE_HOME: /run/build/gtkx-tutorial/flatpak-node/cache
        ESBUILD_BINARY_PATH: /run/build/gtkx-tutorial/flatpak-node/cache/esbuild/bin/esbuild-current
    build-commands:
      - npm ci --offline
      - npm run bundle
      - npm run bundle:postject
      - node --experimental-sea-config sea-config.json
      - cp /usr/lib/sdk/node24/bin/node app
      - node vendor/postject.cjs app NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
      - install -Dm755 app /app/bin/gtkx-tutorial
      - install -Dm755 dist/gtkx.node /app/bin/gtkx.node
      - install -Dm644 data/com.gtkx.tutorial.gschema.xml /app/share/glib-2.0/schemas/com.gtkx.tutorial.gschema.xml
      - glib-compile-schemas /app/share/glib-2.0/schemas
      - install -Dm644 flatpak/com.gtkx.tutorial.desktop /app/share/applications/com.gtkx.tutorial.desktop
      - install -Dm644 flatpak/com.gtkx.tutorial.metainfo.xml /app/share/metainfo/com.gtkx.tutorial.metainfo.xml
      - install -Dm644 data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg /app/share/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg
      - install -Dm644 data/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg /app/share/icons/hicolor/symbolic/apps/com.gtkx.tutorial-symbolic.svg
    sources:
      - type: dir
        path: ..
        skip:
          - node_modules
          - dist
          - build-dir
          - flatpak-repo
          - .flatpak-builder
          - vendor
      - generated-sources.json
```

`id` is the application ID from [Your First Window](/tutorial/your-first-window), and it is also the directory name the sandbox gives you on disk. Keep it in agreement with the desktop entry and the schema path.

`runtime: org.gnome.Platform` with `runtime-version: "50"` is the pin: GTK4, Adwaita, GLib, and the icon theme all come from that runtime version, on every machine. `sdk: org.gnome.Sdk` is the same platform plus compilers and headers, used only at build time.

`sdk-extensions` adds `org.freedesktop.Sdk.Extension.node24`, because the GNOME SDK carries no Node.js. It installs under `/usr/lib/sdk/node24`, so `append-path: /usr/lib/sdk/node24/bin` puts `npm` on `PATH`; without it the first build command fails with `npm: command not found`. `npm_config_nodedir` points native module builds at that same Node.js instead of a copy npm would download.

`strip: false` matters for the reason [Appendix B](/tutorial/packaging) explains, and flatpak-builder strips your binary by default.

The build commands do what Appendix B did by hand, now inside the sandbox, then install the schema, the desktop entry, the metainfo, and the icons where the system expects them. `glib-compile-schemas` runs against `/app/share/glib-2.0/schemas` after the schema lands there, so the preferences from [Preferences and the System Theme](/tutorial/preferences-and-theming) resolve inside the sandbox.

The `dir` source builds your working tree, skipping everything derived. The other source, `generated-sources.json`, does not exist yet.

## Building offline

The build sandbox has no network: `npm ci` cannot reach the registry and esbuild cannot download its platform binary. This keeps builds reproducible, and Flathub enforces it.

So resolve every dependency ahead of time into a manifest of URLs and checksums that `flatpak-builder` fetches before it seals the sandbox. [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node) reads a lockfile and writes that manifest. Install it with `pipx install flatpak-node-generator`.

Create `flatpak/generate-sources.sh`:

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if ! command -v flatpak-node-generator >/dev/null 2>&1; then
    echo "Error: flatpak-node-generator not found." >&2
    echo "Install it with: pipx install flatpak-node-generator" >&2
    exit 1
fi

echo "Resolving package-lock.json from npm (requires network)..."
rm -f package-lock.json
npm install --package-lock-only --no-audit --no-fund

echo "Vendoring npm dependencies into flatpak/generated-sources.json..."
flatpak-node-generator npm package-lock.json -o flatpak/generated-sources.json

echo ""
echo "Done. package-lock.json and flatpak/generated-sources.json are ready to build."
```

The build itself gets a script too, so the lint and the missing-sources check run before `flatpak-builder` does. Create `flatpak/build.sh`:

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Validating desktop entry and metainfo..."
npm run flatpak:lint

if [[ ! -f flatpak/generated-sources.json ]]; then
    echo "Error: flatpak/generated-sources.json is missing." >&2
    echo "Run 'npm run flatpak:sources' first." >&2
    exit 1
fi

echo "Building flatpak from source in a sandbox..."
flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo=flatpak-repo \
    build-dir \
    flatpak/com.gtkx.tutorial.yaml

echo ""
echo "Build complete. Install with:"
echo "  flatpak install --user flatpak-repo com.gtkx.tutorial"
echo "  flatpak run com.gtkx.tutorial"
```

Add all three to `package.json` alongside the scripts from Appendix B:

```json
{
  "scripts": {
    // ...
    "flatpak:lint": "desktop-file-validate flatpak/com.gtkx.tutorial.desktop && appstreamcli validate --no-net flatpak/com.gtkx.tutorial.metainfo.xml",
    "flatpak:sources": "bash flatpak/generate-sources.sh",
    "flatpak:build": "bash flatpak/build.sh"
  }
}
```

Run it whenever a dependency changes:

```bash
npm run flatpak:sources
```

`flatpak-builder` unpacks those sources into `flatpak-node/` inside the build directory, and the module's environment variables point every cache at that tree. `npm_config_offline` makes npm fail instead of reaching out, `npm_config_cache` is the offline package store it installs from, `XDG_CACHE_HOME` catches the caches other tools would write to `~/.cache`, and `ESBUILD_BINARY_PATH` hands esbuild the binary it would otherwise fetch.

`postject`, which injects the application blob into the `node` binary, does not come through npm at build time. The manifest calls it as `node vendor/postject.cjs`, the self-contained CommonJS file the `bundle:postject` script from Appendix B produces, so the build step needs no package resolution.

Now build it:

```bash
npm run flatpak:build
```

`--install-deps-from=flathub` pulls the GNOME runtime and the Node.js SDK extension, which is slow the first time and then cached. `--repo=flatpak-repo` writes the result as a local repository you can install from.

## What the sandbox does not grant

Look at `finish-args` again:

```yaml
finish-args:
  - --share=ipc
  - --socket=fallback-x11
  - --socket=wayland
  - --device=dri
```

Those grant a window on screen and hardware rendering. There is no `--filesystem`, no `--share=network`, and no `--talk-name` for the notification service. Tasks reads and writes your data, sends desktop notifications, and stores preferences with none of those.

**No filesystem permission**, thanks to a decision from [Saving Tasks Between Runs](/tutorial/saving-to-disk). The storage backend resolves its directory from `XDG_DATA_HOME`, which Flatpak sets to the app's private directory before the process starts. The code that found `~/.local/share/com.gtkx.tutorial` on your machine finds `~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial` inside the sandbox, unchanged. A hardcoded path, or one built from `homedir()` alone, would need `--filesystem=home`, and Flathub reviewers would ask why.

**No notification permission**, because `Gio.Notification` goes through a portal. The reminder from [Reminders That Reach the Desktop](/tutorial/reminders) is handed to the application, and inside a sandbox that call routes to the notification portal instead of a raw D-Bus name. The portal asks the user, keeps the permission revocable in system settings, and delivers **Mark Complete** back to your `app.complete-task` action.

**No network permission**, because the app never opens a socket. Everything it knows lives in one JSON file and one GSettings schema.

## Run it

Install from the local repository and launch:

```bash
flatpak install --user flatpak-repo com.gtkx.tutorial
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

That directory still holds the tasks you added throughout this tutorial, with no `Ship it` among them. The two stores are independent, share one storage backend, and need no branch anywhere in your code.

Search the overview for Tasks and both entries appear, each with the icon from Appendix B. Remove the sandboxed one with `flatpak uninstall --user com.gtkx.tutorial` and its data directory stays behind, as it does for every application Flatpak hosts.

## Submitting to Flathub

Flathub builds your manifest on its own infrastructure and publishes the result.

**The manifest must build from a pinned source.** Swap the `dir` source for the release you tagged, so the build is reproducible from a URL instead of your working tree:

```yaml
    sources:
      - type: git
        url: https://github.com/you/your-app.git
        commit: <release commit sha>
      - generated-sources.json
```

Commit `package.json`, `package-lock.json`, and `flatpak/generated-sources.json` to that repository first, since the offline build reads all three.

**The metadata must validate.** The AppStream metainfo from Appendix B is the store listing: its `id` must match the application ID, its `launchable` must point at the desktop entry, and its screenshots are what people see before installing. Check both before you open a pull request:

```bash
npm run flatpak:lint
```

**The pull request goes to [flathub/flathub](https://github.com/flathub/flathub)**, against the `new-pr` branch, carrying the manifest and `generated-sources.json`. A reviewer reads your `finish-args` first, and a short one backed by portals is the quickest to approve.

Rerun `npm run flatpak:sources` on every dependency change: a stale `generated-sources.json` only fails inside the sandbox.

## Next

Read the [complete source on GitHub](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial), then start your own with `npm create gtkx`.
