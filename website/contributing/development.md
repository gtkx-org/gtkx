---
title: "Development Setup"
description: "Set up the GTKX repository, build packages, run examples, and work on the documentation."
---

# Development Setup

Build the workspace, run an example, then use focused Nx targets while making changes. The [package map](/contributing/tech-stack#package-map) identifies each package's role.

## Prerequisites

Use Linux with Node.js 26.7 or later. The repository's `mise.toml` selects Node 26, and `package.json` pins pnpm through its `packageManager` field. If your runtimes are managed by mise, run the commands below through `mise exec --`, for example `mise exec -- pnpm install`.

Install Rust through rustup so `rust-toolchain.toml` selects the pinned compiler and Clippy. Native formatting and sanitizers use a separate nightly; its installation command is under [Change native code](#change-native-code).

The full workspace needs more system libraries than a minimal application:

| Work | System dependencies |
| --- | --- |
| Native addon and bindings | A C build toolchain, `pkg-config`, GObject Introspection, GLib, GTK4, and libadwaita development files. |
| Workspace library selection | GtkSourceView 5 and WebKitGTK 6.0 development files and GIR metadata. |
| Native integration fixtures | Git, Meson, Ninja, and the introspection scanner. |
| Headless examples and tests | A supported compositor, normally Sway, `dbus-daemon`, `setpriv`, Mesa rendering support, fonts, icons, MIME data, and GSettings schemas. |
| Localization and packaging checks | GNU gettext and the packaging tools used by the target formats, including RPM and Debian tooling and Flatpak helpers. |

GTKX's application baseline is GTK 4.20 and libadwaita 1.8 or later. Distribution package names and available versions vary. The [CI Dockerfile](https://github.com/gtkx-org/gtkx/blob/main/.github/docker/Dockerfile) records the complete verification environment, including packaging tools, fonts, and pinned toolchains.

On Debian or Ubuntu releases providing those library versions, the development packages include:

```bash
sudo apt install build-essential pkg-config gobject-introspection \
    libgirepository1.0-dev libgtk-4-dev libadwaita-1-dev \
    libgtksourceview-5-dev libwebkitgtk-6.0-dev meson ninja-build
```

This command covers native development and fixtures, not the full headless and packaging environment listed above. Check the installed library versions before building:

```bash
pkg-config --modversion gtk4 libadwaita-1
```

## Clone and build

Clone the repository, or substitute your fork's URL:

```bash
git clone https://github.com/gtkx-org/gtkx.git
cd gtkx
pnpm install
pnpm build
```

`pnpm install` links workspace dependencies and builds the Vitest plugin's TypeScript output through the root postinstall script. `pnpm build` runs Nx's build targets with their dependencies. This includes the native addon, generated bindings, TypeScript libraries, application bundles, and website build where those targets exist.

The first full build is substantial: native compilation, OpenGL generation, and website API references all participate. Building references for a pinned documentation version may also need network access to retrieve that release's source and dependencies.

For subsequent work, use the target for the package you are changing:

```bash
pnpm nx run @gtkx/react:build
pnpm nx run @gtkx/react:typecheck
pnpm nx run @gtkx/react:lint
```

Nx runs the required dependency targets. A package build can therefore rebuild another package or regenerate bindings first. Inspect the graph and an individual project's targets with:

```bash
pnpm nx show projects
pnpm nx show project @gtkx/react
```

## Generated bindings

The root `gtkx.config.ts` re-exports `gtkx.config.base.ts`. That configuration selects the workspace's additional native libraries and reads `GTKX_GIR_PATH` when GIR files are installed outside the normal search paths.

Regenerate the workspace's bindings and other codegen targets through Nx:

```bash
pnpm codegen
```

For only the root GIR and JSX bindings:

```bash
pnpm nx run gtkx:codegen
```

Each application example has its own configuration and codegen target. Example build and development targets generate their own bindings before starting. Generated bindings live in `node_modules/.gtkx`, with package links under `node_modules/@gtkx`; generated widget reference pages live in `.gtkx/reference`.

Change the generator, configuration, or source metadata when correcting generated behavior, then regenerate. Editing a generated output alone will be lost on the next run. For widget work, read the example's `.gtkx/reference/index.md` to find its actual element props, signals, and methods. [Configuration and Codegen](/v2/guide/configuration-and-codegen) covers the application's view of these outputs.

## Run an example

Use an example that exercises the behavior you are changing:

```bash
pnpm nx run hello-world:dev
```

The `hello-world` example is a small application shell and counter. `gtk-demo` covers a wider set of native widgets, and `storybook-example` launches the native story explorer:

```bash
pnpm nx run gtk-demo:dev
pnpm nx run storybook-example:dev
```

Run these separately as needed. The development target builds dependencies, generates the example's bindings, and starts the CLI. Changes to application components participate in Fast Refresh. When editing framework packages, rebuild the affected package and restart the example as needed so it loads the changed output.

After the initial dependency build, the example's local CLI can also start a headless session:

```bash
pnpm --filter hello-world exec gtkx dev --headless --size 1280x720
```

Keep the process's parent session alive while inspecting the app. Use the live widget tree, interactions, and screenshots to verify visible changes. The [MCP guide](/v2/guide/mcp) explains how to connect, and the [Storybook guide](/v2/guide/storybook) covers controls and reusable stories.

## Change native code

Rust source lives in `packages/native/src`. Formatting and sanitizers use the nightly pinned in [scripts/rust-nightly.ts](https://github.com/gtkx-org/gtkx/blob/main/scripts/rust-nightly.ts). After `pnpm install`, install that toolchain from the repository root:

```bash
pnpm exec tsx -e '
import { execFileSync } from "node:child_process";
import { RUST_NIGHTLY } from "./scripts/rust-nightly.ts";
execFileSync("rustup", ["toolchain", "install", RUST_NIGHTLY, "--profile", "minimal", "--component", "rustfmt"], { stdio: "inherit" });
'
```

Rebuild after changing native code, then start a fresh app or test process to load the new binary:

```bash
pnpm nx run @gtkx/native:build
pnpm nx run @gtkx/native:lint:rust
```

The build invokes `napi build` in release mode and produces the platform-specific `.node` file and generated addon declarations. Rust linting runs the pinned nightly rustfmt check followed by Clippy with warnings treated as errors. Changes that affect ownership, callbacks, marshalling, or teardown also belong in the native integration verification described in [Testing](/contributing/testing#native-integration-and-sanitizers).

## Work on the website

Run the site through Nx from the repository root:

```bash
pnpm nx run @gtkx/website:dev
```

This target generates the API references before starting VitePress. For a production build and local preview:

```bash
pnpm nx run @gtkx/website:build
pnpm nx run @gtkx/website:preview
```

The preview target depends on the build target. Prose changes usually belong in Markdown, while navigation, versioning, and theme behavior live in `website/.vitepress`. The Contributing section is shared at `/contributing/` and describes repository development. Guide, Tutorial, and API Reference pages follow the prefixes declared in `website/versions.json`; GTKX 2's application documentation currently lives under `/v2/`.

API pages are generated from package output. Change the exported API documentation at its source and regenerate the reference. See [Maintaining Documentation](/contributing/documentation) for page registration, version manifests, and promotion.

## Prepare a change for review

Use [Testing](/contributing/testing) to select the checks that exercise your change. The broad workspace commands are:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Published-package changes use an Nx version plan created by `pnpm plan`. Documentation-only and test-only changes do not need one. The [contribution guide](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) covers submission and version plans; [Publishing Releases](/contributing/releases) is for maintainers.
