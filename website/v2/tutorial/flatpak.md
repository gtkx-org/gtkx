---
description: "Give the Flatpak access to the notes folder, build and lint it, and prepare a Flathub submission."
---

# Prepare for Flathub

Give the sandboxed Notes access to its notes folder, build and lint the Flatpak, and prepare the source build that [Flathub](https://flathub.org/), the app store and build service for Linux, accepts.

## The notes folder in the sandbox

A Flatpak runs in a sandbox that sees only the files its permissions grant. Notes reads the `Notes` folder in Documents, so grant that folder. Add a `flatpak` block to `deploy` in `gtkx.config.ts`:

```ts [gtkx.config.ts]
flatpak: {
    finishArgs: ["--filesystem=xdg-documents/Notes:create"],
},
```

`xdg-documents` is the folder that `XDG_DOCUMENTS_DIR` names in `~/.config/user-dirs.dirs`. Desktop sessions such as GNOME set it; without it, the permission grants nothing. The `:create` suffix creates `Notes` there on first launch. GTKX adds these arguments to its defaults, which grant the display, IPC and hardware rendering; see [Customize a package](/v2/guide/deploying#customize-a-package) and the [Flatpak permission reference](https://docs.flatpak.org/en/latest/sandbox-permissions.html).

The sandbox reaches no other folder. A folder chosen in Preferences comes through the file chooser portal, which grants access but doesn't report changes other programs make there ([xdg-desktop-portal#567](https://github.com/flatpak/xdg-desktop-portal/issues/567)). A notes folder kept elsewhere needs its own `--filesystem` permission to update live.

The build installs the GNOME runtime from Flathub, so add Flathub as a user remote once. GTKX builds with `flatpak-builder` when it is installed and with Flathub's `org.flatpak.Builder` Flatpak otherwise; install the latter, which also carries the linter Flathub runs. Then build the Flatpak:

```bash
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.flatpak.Builder
npm run deploy -- --target flatpak
```

The bundle is `build/out/dev.gtkx.Notes-1.0.0-x86_64.flatpak`, with `aarch64` on ARM. If the build stops at "Failure spawning rofiles-fuse", see [Flatpak in containers](/v2/guide/deploying#flatpak-in-containers).

## Check the build

Flathub reviews every submission with `flatpak-builder-lint`. Lint the generated manifest and the repository the build exported, under `build/arm64/` on ARM:

```bash
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest build/x64/targets/flatpak/dev.gtkx.Notes.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo build/x64/targets/flatpak/repo
```

Fix each error, or explain it in the submission; [Flathub's linter documentation](https://docs.flathub.org/linter) describes each check and its exceptions. On a local build, the `repo` check reports `appstream-external-screenshot-url` and `appstream-screenshots-not-mirrored-in-ostree`: only Flathub's build copies the screenshots to Flathub's servers.

## Run it

Install the bundle and start Notes:

```bash
flatpak install --user build/out/dev.gtkx.Notes-1.0.0-x86_64.flatpak
flatpak run dev.gtkx.Notes
```

Notes creates `Documents/Notes` if it doesn't exist and lists the notes in it. A note another program saves there appears in the list. Check the sandbox's permissions:

```bash
flatpak info --show-permissions dev.gtkx.Notes
```

```txt
[Context]
shared=ipc;
sockets=fallback-x11;wayland;
devices=dri;
filesystems=xdg-documents/Notes:create;
```

## Submit to Flathub

Flathub builds open-source apps from source, so it takes a source-mode manifest, not the prebuilt one above. Push Notes to its own public repository with `package-lock.json` committed, tag a release, and set `deploy.flatpak.mode` to `"source"` with the repository's URL and tag, as [Source Flatpak builds](/v2/guide/deploying#publishing-on-flathub) explains. Install `flatpak-node-generator`, which lists the npm dependencies for Flathub's offline build, then write the manifest and `generated-sources.json` to `build/x64/targets/flatpak/` without building:

```bash
npm run deploy -- --target flatpak --print-manifests
```

Flathub verifies that the application ID belongs to you, so replace `dev.gtkx.Notes` with an ID under a domain or repository you control; see [Flathub's requirements](https://docs.flathub.org/docs/for-app-authors/requirements#control-over-domain-or-repository). Then follow [Flathub's submission guide](https://docs.flathub.org/docs/for-app-authors/submission): test the source manifest with its build command and open the pull request with both generated files. Explain the `xdg-documents` permission there, because reviewers check every static permission.

## Next

Notes is complete. The guide covers what it didn't need: [Cairo](/v2/guide/cairo) and [OpenGL](/v2/guide/opengl) drawing, [animations](/v2/guide/animations), [forms](/v2/guide/forms), [D-Bus](/v2/guide/dbus), and [workspaces](/v2/guide/workspaces) for apps that share code.
