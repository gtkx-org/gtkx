<p align="center">
  <img src="logo.svg" alt="gtkx" width="120" />
</p>

<h1 align="center">gtkx</h1>

<p align="center">
  Linux desktop application development for the modern age.<br />
  Write declarative JSX; gtkx renders real native GTK4 and libadwaita widgets — no webview, no Electron.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@gtkx/cli"><img src="https://img.shields.io/npm/v/@gtkx/cli?color=cb3837&logo=npm&label=%40gtkx%2Fcli" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@gtkx/cli"><img src="https://img.shields.io/npm/dm/@gtkx/cli?color=cb3837&logo=npm&label=downloads" alt="npm downloads" /></a>
  <img src="https://img.shields.io/node/v/@gtkx/cli?logo=node.js&label=node" alt="Node >=24" />
  <a href="https://github.com/gtkx-org/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License: MPL-2.0" /></a>
  <a href="https://github.com/gtkx-org/gtkx/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/gtkx-org/gtkx/ci.yml?branch=main&logo=github&label=CI" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <a href="https://gtkx.dev">Homepage</a> &middot;
  <a href="#documentation">Documentation</a> &middot;
  <a href="#examples">Examples</a> &middot;
  <a href="docs/architecture.md">Architecture</a> &middot;
  <a href="#contributing">Contributing</a>
</p>

---

gtkx is a framework for building native GTK4/libadwaita desktop applications with React, TypeScript, and JSX. You write declarative JSX whose element types are GTK widget names; a custom react-reconciler maps that tree to live GObject instances, while a Rust napi addon owns the single GLib main-loop thread and performs every call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into typed bindings, JSX element types, and reconciler metadata, and a Vite-based CLI provides scaffolding, a hot-reloading dev server, single-file production bundling, and GTK-asset integration.

## Table of contents

- [Demo](#demo)
- [Why gtkx](#why-gtkx)
- [Quick start](#quick-start)
- [Examples](#examples)
- [Packages](#packages)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Demo

![gtkx demo](demo.gif)

The window above is rendered by the app below. The JSX element types are real GTK widgets, and standard React (hooks, events) drives them:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <GtkApplicationWindow
      title="Hello GTKX"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={() => {
        quit();
        return true;
      }}
    >
      <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={20}
        marginTop={40}
        marginBottom={40}
        marginStart={40}
        marginEnd={40}
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
      >
        <GtkLabel label="Welcome to GTKX!" cssClasses={["title-1"]} />
        <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} />
        <GtkButton
          label="Increment"
          onClicked={() => setCount((c) => c + 1)}
          cssClasses={["suggested-action", "pill"]}
        />
      </GtkBox>
    </GtkApplicationWindow>
  );
};

const App = () => (
  <GtkApplication>
    <Counter />
  </GtkApplication>
);

createRoot().render(<App />);
```

This is the [`hello-world`](examples/hello-world) example, verbatim.

## Why gtkx

- **Real React.** Declarative JSX, hooks, and Fast Refresh, backed by a custom react-reconciler that maps your component tree to live GObject instances.
- **Full GTK4 + libadwaita.** Typed bindings, JSX element types, and reconciler metadata generated from GObject-Introspection (GIR) XML — the whole widget surface, fully typed.
- **Native performance.** A Rust napi addon owns the single GLib main-loop thread and performs every call into GTK, with no DOM and no web view in the path.
- **Modern DX.** A Vite-based CLI for scaffolding, a hot-reloading dev server, single-file production bundling, and GTK-asset integration.
- **Styling + animation.** `@gtkx/css` brings Emotion-style CSS-in-JS to GTK CSS classes, and `@gtkx/animate` provides libadwaita-driven animation components.
- **Testing + AI.** A Testing Library-style harness (`@gtkx/testing`) with `@gtkx/vitest` headless display isolation, plus an MCP server (`@gtkx/mcp`) that exposes live widgets to AI agents.

gtkx binds the GNOME stack (GTK4, libadwaita, GLib/GObject) the same way [GJS](https://gitlab.gnome.org/GNOME/gjs), [node-gtk](https://github.com/romgrk/node-gtk), and PyGObject do — but gives you the React programming model on top.

## Quick start

Scaffold and run a new app with the official `create-gtkx` initializer:

```sh
npm create gtkx@latest
```

The wizard creates the project, installs dependencies, and initializes a git repository. Then:

```sh
cd my-app
npm run dev
```

Every scaffolded app exposes the standard `dev`, `build`, and `start` scripts, which wrap the CLI (`gtkx dev` / `gtkx build` / `node dist/bundle.js`).

> [!NOTE]
> gtkx is a Linux desktop framework, not a browser/DOM renderer. You need GTK4, libadwaita, and the GNOME development toolchain installed before an app will build or run. See [Prerequisites](#contributing) for the full list.

## Examples

The example apps live under [`examples/`](examples). Each exposes the standard `dev`, `build`, and `start` scripts that wrap the CLI (`gtkx dev` / `gtkx build` / `node dist/bundle.js`). Run any of them from a built checkout (see [Contributing](#contributing)):

```sh
# Counter app demonstrating the basics
pnpm --filter hello-world dev

# Notes app from the tutorial (uses @gtkx/css and @gtkx/animate, GSettings via #data)
pnpm --filter tutorial dev

# GTK4 widget showcase (the React port of the official gtk-demo; the only example with tests)
pnpm --filter gtk-demo dev
pnpm --filter gtk-demo coverage

# Simple browser using WebKitWebView
pnpm --filter browser dev
```

Build and run any example's production bundle:

```sh
pnpm --filter hello-world build
pnpm --filter hello-world start
```

The tutorial additionally packages as a single executable (`pnpm --filter tutorial build:sea`) and as a Flatpak (`pnpm --filter tutorial build:flatpak`); these need esbuild, postject, and a Flatpak toolchain.

## Packages

| Package | Role |
| --- | --- |
| `@gtkx/native` | Rust napi addon: owns the single GLib main-loop thread and performs all libffi C calls into GTK/GObject. |
| `@gtkx/ffi` | Hand-written TS runtime over the addon: GObject construction, GValue marshalling, signals, subclassing, and the GType↔JS registry. |
| `@gtkx/react` | Custom react-reconciler host config mapping JSX to GObject instances, plus higher-level components and GObject-aware hooks. |
| `@gtkx/codegen` | Build-time GIR/Khronos generator producing the `@gtkx/gi` and `@gtkx/jsx` stores, reconciler metadata, and `@gtkx/gl`. |
| `@gtkx/cli` | User-facing CLI and Vite integration: scaffolding, hot-reloading dev, production bundling, GTK-asset plugins, and the MCP client. |
| `@gtkx/config` | Single source of truth for `gtkx.config.ts`: schema, validation, and the `virtual:gtkx-config` Vite module. |
| `@gtkx/gi` | Generated low-level FFI bindings, one module per GIR namespace, plus hand-written overrides. |
| `@gtkx/jsx` | Generated React/JSX bindings: intrinsic elements, per-widget Props, compound components, and reconciler metadata. |
| `@gtkx/css` | Emotion-based CSS-in-JS compiling tagged-template styles into GTK CSS classes through a process-wide `CssProvider`. |
| `@gtkx/animate` | React animation components interpolating opacity/transform via libadwaita animations written out as GTK CSS. |
| `@gtkx/gl` | Hand-curated OpenGL 4.6 core bindings for use inside `GtkGLArea` render callbacks. |
| `@gtkx/mcp` | Model Context Protocol server exposing widget-inspection/interaction tools to AI agents over a Unix socket. |
| `@gtkx/testing` | Testing Library-style harness over real GObject widgets: render/cleanup, accessibility-first queries, `userEvent`, screenshots. |
| `@gtkx/vitest` | Vitest plugin provisioning per-worker headless display isolation and the gtkx config virtual module. |
| `@gtkx/utils` | Dependency-free leaf of pure helpers: casing, safe identifiers, collection helpers, error normalization. |
| `@gtkx/e2e` | _Private._ In-repo end-to-end suite plus CodSpeed performance benchmarks under the headless harness. |

## Documentation

Architecture and subsystem docs live under `docs/`.

**Architecture**

- [`docs/architecture.md`](docs/architecture.md) — architecture overview and layer stack.
- [`docs/rendering.md`](docs/rendering.md) — the render and event pipeline.
- [`docs/codegen.md`](docs/codegen.md) — the GIR/Khronos code generator and the runtime contract.
- [`docs/styling.md`](docs/styling.md) — styling, animation, and GL.

**Workflow**

- [`docs/cli.md`](docs/cli.md) — the CLI and project workflow.
- [`docs/testing.md`](docs/testing.md) — the testing architecture.
- [`docs/mcp.md`](docs/mcp.md) — the MCP server.
- [`docs/build-system.md`](docs/build-system.md) — the build system and quality tooling.

For an agent-oriented index of packages and the hard build rules, see [`CLAUDE.md`](CLAUDE.md).

## Contributing

Building gtkx from source means cloning the monorepo and compiling the Rust addon and the generated binding stores.

> [!IMPORTANT]
> codegen and native-build come first. A clean checkout cannot type-check or build any TypeScript package until the Rust addon is compiled and codegen has produced `.gtkx` — both are hard Turbo upstreams. `pnpm build` runs them before any TS package builds.

```sh
git clone https://github.com/gtkx-org/gtkx.git
cd gtkx
corepack enable
pnpm install
pnpm build
```

`pnpm build` runs the Rust `native-build` and `@gtkx/cli#codegen` first (hard Turbo upstreams), so the first build compiles the addon and generates the `@gtkx/gi`/`@gtkx/jsx` binding stores before any TypeScript package builds.

<details>
<summary><strong>Prerequisites</strong></summary>

<br />

This is a Linux desktop framework, not a browser/DOM renderer. You need:

- **Node.js** — the engines floor is Node `>=24`.
- **pnpm** — the workspace package manager, provisioned via Corepack from the `packageManager` field.
- **Rust toolchain** — 2024 edition with a C linker, plus the napi-rs CLI and Node N-API headers, to compile the native addon. A nightly toolchain is additionally required for the coverage, asan, and miri paths.
- **libffi** — for dynamic CIF construction and closures in the native addon.
- **GTK4 and libadwaita** development libraries, plus the broader GNOME library set the examples use (GtkSourceView, WebKitGTK, VTE, GStreamer, etc.), with `pkg-config`.
- **GLib/GObject** shared libraries present at build and run time; gtkx resolves GTK symbols dynamically by name.
- **GObject-Introspection** development data and system GIR files (read by codegen), plus `glib-compile-resources` and `glib-compile-schemas` for asset compilation.
- **A headless Wayland compositor** (Weston, or Sway when `GTKX_COMPOSITOR=sway`) and software GL/Vulkan rasterization to run GTK tests and benches without a GPU.
- **git**, for repository initialization during scaffolding.

For the containerized CI path you additionally need Docker; the CI image pins the full GTK/Rust/Node toolchain.

</details>

<details>
<summary><strong>Common commands</strong></summary>

<br />

All root scripts run through Turbo over the workspace (the root meta-package is excluded with `--filter=!gtkx`).

| Command | Description |
| --- | --- |
| `pnpm build` | Build all workspace packages (runs codegen + native-build first). |
| `pnpm --filter <pkg> dev` | Start a package/example dev server (hot-reloading `gtkx dev`); see [Examples](#examples). There is no root `dev` script. |
| `pnpm test` | Run the Vitest workspace plus per-package test scripts. |
| `pnpm typecheck` | Type-check every package via `tsc -b --emitDeclarationOnly` across the reference graph. |
| `pnpm lint` | Full quality gate: ts-reference drift check, biome, knip (default + production), dependency-cruiser, plus per-package lint (Rust fmt/clippy on native). |
| `pnpm codegen` | Generate/refresh the `.gtkx` GIR and JSX binding stores consumed by other packages. |
| `pnpm coverage` | Aggregated v8 lcov coverage (TS) plus native Rust coverage. |
| `pnpm sync:ts-refs` | Rewrite TypeScript project references from `package.json` deps and format them (add `--check` to fail on drift). |
| `pnpm asan` / `pnpm miri` / `pnpm bench` | Native AddressSanitizer suite, Miri marshalling subset, and CodSpeed benchmarks under the headless compositor. |
| `pnpm release` | Build, inject README into published packages, stage native artifacts, and publish to npm. |
| `pnpm publish-test` | Publish to an ephemeral Verdaccio registry, then scaffold, build, typecheck, and test a consumer app end-to-end. |

To run tests or builds for a single package, filter through Turbo or pnpm, for example:

```sh
pnpm --filter @gtkx/ffi test
pnpm --filter @gtkx/react test
pnpm --filter @gtkx/cli build
```

</details>

<details>
<summary><strong>Gotchas</strong></summary>

<br />

- **codegen and native-build come first.** A clean checkout cannot type-check or build any TypeScript package until the Rust addon is compiled and codegen has produced `.gtkx`; both are hard Turbo upstreams. `pnpm lint` first creates the `.gtkx` symlink that knip and dependency-cruiser resolve against.
- **Generated packages are not hand-edited.** `@gtkx/gi`, `@gtkx/jsx`, and the generated `@gtkx/gl` sources come from `@gtkx/codegen`. Change the emitters or `gtkx.config.ts` and regenerate (`pnpm codegen`); the store swap is atomic, so partial writes never appear.
- **GTK tests/benches need a headless display.** Running native `test`/`coverage`/`asan` or the GTK suites outside the headless wrapper fails to initialize a display; the harness provisions a Wayland compositor with software rendering. Native tests run single-threaded because GTK requires a single owning thread.
- **The native runtime is single-use.** All GObject/GTK mutation runs only on the single `gtkx-glib` thread; native init is one-shot and quit is terminal, so a process cannot restart the runtime. Importing `@gtkx/ffi` starts the GLib main loop and registers a process exit handler.
- **Project references track deps.** TypeScript references are generated from `package.json` dependency fields by `sync-ts-references`; hand-editing them is reported as drift by the `--check` run in lint. Change deps, then run `pnpm sync:ts-refs`.
- **`@gtkx/testing` cleanup is not automatic.** Consumers must register `cleanup()` (the e2e setup wires it into `afterEach`/`afterAll`), or leaked windows persist across tests.
- **The dev loop restarts via exit code 75.** The dev supervisor and runner signal restart intent purely through process exit code 75; Fast Refresh applies only to SSR-transformed project files where every export looks like a React component, otherwise the whole process restarts.

</details>

## License

[MPL-2.0](LICENSE)
