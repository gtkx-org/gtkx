---
title: "Deploying"
description: "Build Flatpak, deb, rpm, and AppImage packages from one configuration."
---

# Deploying

`gtkx deploy` generates application metadata, stages the runtime, validates it, and invokes the selected packager.

| Target | Output |
| --- | --- |
| `flatpak` | Sandboxed bundle with a pinned GNOME runtime |
| `deb` | Debian or Ubuntu package |
| `rpm` | Fedora, RHEL, or openSUSE package |
| `appimage` | Portable executable image |

Flatpak is the default. Select targets in `deploy.targets` or for one run:

```bash
gtkx deploy --target deb,rpm
```

## Configure the package

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    applicationIcon: "data/icons",
    deploy: {
        summary: "Manage your tasks and to-dos",
        categories: ["Office"],
    },
});
```

GTKX derives names, version, description, author, license, homepage, release metadata, and base dependencies from `package.json`, the application ID, and built binaries. Run without a `deploy` block to print a starter config. The [configuration reference](/reference/@gtkx/config/) documents overrides and target-specific options.

An application icon is required. Point `applicationIcon` at an icon-theme tree or one image named for the application ID. GTKX installs the bundle, native addon, Node.js, resources, schemas, metadata, icons, catalogs, MIME declarations, licenses, and declared extra files under the target prefix.

Set `minimumLibraryVersions` for every newer GTK or Adwaita API the application relies on. Without it, a distribution package may install on a host whose older shared library lacks a required symbol.

## Runtime and build tools

GTKX bundles the verified official Node.js 26.7 runtime by default and caches it under `~/.cache/gtkx/node/`. Use `deploy.node.source: "host"` for a fully offline compatible binary, or `"path"` with `deploy.node.path`. Host binaries with dependencies unavailable on the target are rejected.

All targets require `desktop-file-validate` and `appstreamcli`. Catalogs require GNU gettext 0.25 or later. Flatpak needs Flatpak Builder; AppImage needs `file`. GTKX downloads and verifies `nfpm` and AppImage tooling. A source-mode Flatpak also needs `flatpak-node-generator`; pnpm projects need a version supporting `--pnpm-store-version`.

When tools are missing, the command reports all of them with distribution-specific installation instructions.

## Third-party notices

Every package includes notices for the bundled Node.js runtime, GTKX, reached JavaScript dependencies, and dynamically linked GNOME libraries:

- deb installs machine-readable notices at `share/doc/<binaryName>/copyright`.
- rpm, AppImage, and Flatpak install `share/licenses/<binaryName>/THIRD-PARTY-NOTICES` beside the application's license.

The official Node.js archive supplies its aggregate license for embedded projects such as V8, OpenSSL, ICU, and libuv. For `host` and `path` sources, GTKX looks for a Node.js license beside the binary; when none is found, it warns and records a link instead of claiming the text is present.

The GTKX notice identifies the MPL-2.0 modules in the bundle, links to their release source, and records licenses used by the statically linked Rust crates. Build metadata records JavaScript packages reached by the final module graph. Deploy reproduces their license files or SPDX identifiers and warns about missing terms or unavailable package directories instead of silently omitting them.

GTK, Adwaita, GtkSourceView, WebKitGTK, GLib, GObject, and Gio are resolved as shared libraries at runtime rather than copied into the package. The notices identify their LGPL terms and sources. `dist/gtkx-schemas.json` only carries versioned inputs for packaging and notices; it is not installed. The compiled schemas are runtime data and are installed.

Source-mode Flatpak uses the Node SDK extension instead of a downloaded archive. It installs the extension's Node license when one is present and otherwise records the published license location.

## Review before packaging

```bash
gtkx deploy --print-manifests
```

This writes and validates desktop, AppStream, and target manifests without running packagers. `--skip-build` packages an existing `dist/`; rebuild once if it predates the current metadata format. `--out` changes the default `build` directory.

AppStream errors always fail. Warnings fail for software-center targets such as Flatpak and remain visible for other formats.

## Grant only required access

Flatpak defaults provide display and hardware rendering access: `--share=ipc`, Wayland and fallback X11 sockets, and `--device=dri`. Add permissions with `deploy.flatpak.finishArgs`; use Flatpak's negative forms to remove defaults. GTKX warns when no display socket remains or a WebKit application lacks network access.

Use `extraFiles`, package relationships, maintainer scripts, custom modules, cleanup rules, and signing only when generated output cannot express a requirement. Preview the manifest after each escape hatch. Set `deploy.flatpak.shouldUseRofilesFuse: false` only where FUSE is unavailable, such as some containers.

## Publish on Flathub

Flathub builds from source. Set `deploy.flatpak.mode: "source"` to generate a pinned Git source, offline package-manager dependencies, inline generated metadata, and build commands. Referenced licenses and extra files must be committed inside the repository.

The root lockfile selects npm, pnpm, or yarn. For pnpm, record a supported version and integrity with `corepack use pnpm@<version>`; source builds vendor the tarball because the sandbox has no network access.

[Package and Publish Tasks](/tutorial/packaging#submit-to-flathub) shows the workflow.
