---
description: "Give the Flatpak access to the notes folder and check the app against Flathub's requirements."
---

# Prepare for Flathub

Give the sandboxed app access to the notes folder, then check the Flatpak against Flathub's requirements before submitting it.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## The notes folder in the sandbox

A Flatpak runs in a sandbox that sees only the files its permissions grant. Notes reads `Notes` in the Documents folder, so grant that folder in `deploy.flatpak.finishArgs`. The `:create` suffix creates it on first launch:

<<< @/figures/tutorial/flatpak/gtkx.config.ts{46-48} [gtkx.config.ts]

GTKX adds these arguments to its display, IPC and GPU defaults; see [Customize a package](/v2/guide/deploying#customize-a-package). The sandbox reaches no other folder. A folder chosen in Preferences comes through the file chooser portal, which grants access but doesn't report changes other programs make there, so a notes folder kept elsewhere needs its own `--filesystem` permission to update live. The [Flatpak permission reference](https://docs.flatpak.org/en/latest/sandbox-permissions.html) lists the forms.

The build installs the GNOME runtime from Flathub, so add Flathub as a user remote once, then build the Flatpak:

```bash
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
npm run deploy -- --target flatpak
```

The bundle is `build/out/dev.gtkx.Notes-1.0.0-x86_64.flatpak`, with `aarch64` on ARM. If the build stops at "Failure spawning rofiles-fuse", see [Flatpak in containers](/v2/guide/deploying#flatpak-in-containers).

## Check the build

Flathub reviews every submission with `flatpak-builder-lint`, which ships in Flathub's builder. Install it and lint the generated manifest, under `build/arm64/` on ARM:

```bash
flatpak install --user flathub org.flatpak.Builder
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest build/x64/targets/flatpak/dev.gtkx.Notes.yml
```

Fix each error, or explain it in the submission; [Flathub's linter documentation](https://docs.flathub.org/linter) describes each check and its exceptions. The linter's `repo` check reports `appstream-external-screenshot-url` on a local build, because only Flathub's build copies the screenshots to Flathub's servers.

## Submit to Flathub

Flathub builds open-source apps from source, so it takes a source-mode manifest, not the prebuilt one above. Push Notes to its own public repository with `package-lock.json` committed, tag a release, and set `deploy.flatpak.mode` to `"source"` with the repository's URL and tag, as [Source Flatpak builds](/v2/guide/deploying#publishing-on-flathub) explains. The next `npm run deploy -- --target flatpak` writes the manifest and `generated-sources.json` to `build/x64/targets/flatpak/`.

Flathub verifies that the application ID belongs to you, so replace `dev.gtkx.Notes` with an ID under a domain or repository you control; see [Flathub's requirements](https://docs.flathub.org/docs/for-app-authors/requirements#control-over-domain-or-repository). Then open the pull request that [Flathub's submission guide](https://docs.flathub.org/docs/for-app-authors/submission) describes, with both generated files, and explain the `xdg-documents` permission there: reviewers check every static permission.

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
