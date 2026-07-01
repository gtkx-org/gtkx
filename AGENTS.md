# CLAUDE.md

gtkx is a framework for building native GTK4/libadwaita desktop applications with React, TypeScript, and JSX. App authors write declarative JSX whose element types are GTK widget names; a custom react-reconciler maps that tree to live GObject instances, while a Rust napi addon owns the single GLib main-loop thread and performs every libffi call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into the typed bindings, JSX element types, and reconciler metadata the runtime consumes, and a Vite-based CLI provides scaffolding, hot-reloading dev, single-file production bundling, and GTK-asset integration.

Homepage: https://gtkx.dev

## Packages

| Package | Role |
| --- | --- |
| `@gtkx/native` | Rust napi addon: owns the single GLib main-loop thread, performs all libffi C calls into GTK/GObject, marshals values via the Type descriptor contract, registers JS-backed subclasses/vfuncs, binds wrapper lifetime to native GObjects. |
| `@gtkx/ffi` | Hand-written TS runtime over the addon: GObject construction, value marshalling, signals and trampolines, subclass registration, the GType-to-class registry and wrapper identity, and the Type descriptor vocabulary the generated bindings target. |
| `@gtkx/react` | Custom react-reconciler host config mapping JSX to GObject instances, plus the GObject-aware hooks; drives prop application, child attachment, and the commit freeze/signal-block strategy. |
| `@gtkx/components` | Hand-written higher-level component families (list, grid, column, drop-down, menu, constraint layout) over the generated bindings. |
| `@gtkx/codegen` | Build-time GIR/Khronos generator producing the `@gtkx/gi` and `@gtkx/jsx` binding stores, the reconciler metadata, and `@gtkx/gl`; owns the Type descriptor and helper-name contract the runtimes implement. |
| `@gtkx/cli` | User-facing CLI and Vite integration: hot-reloading dev supervisor over SSR with Fast Refresh, single-file production bundling, codegen orchestration with freshness checks, the GTK-asset Vite plugins, and the embedded MCP client. |
| `@gtkx/config` | Single source of truth for `gtkx.config.ts`: schema, validation, loading and resolution, the binding-table rule schema, the wrapper-protocol constants, and the Vite plugin that emits the `virtual:gtkx-config` module fusing resolved config with codegen metadata. |
| `create-gtkx` | The `create` scaffolder: renders project templates, installs dependencies, and initializes a git repository; the CLI's `create` subcommand delegates here. |
| `@gtkx/gi` | Generated low-level FFI bindings: one module per GIR namespace plus hand-written overrides; resolves as a real installed package via codegen symlinks. |
| `@gtkx/jsx` | Generated React/JSX bindings: intrinsic element types, per-widget prop interfaces, compound components, the JSX intrinsic-elements augmentation, and the reconciler metadata module. |
| `@gtkx/css` | Emotion-based CSS-in-JS that compiles tagged-template styles into GTK CSS classes pushed through a process-wide CSS provider; raw global stylesheet injection; supports GTK `@named-colors`. |
| `@gtkx/animate` | React animation components (tween/spring transitions and presence-aware enter/exit) that interpolate opacity/transform via libadwaita animations and write them out as per-element GTK CSS. |
| `@gtkx/gl` | Hand-curated OpenGL core bindings generated from the vendored Khronos registry plus companion helpers, for use inside GL-area render callbacks. |
| `@gtkx/mcp` | Model Context Protocol server exposing widget-inspection/interaction tools to AI agents over stdio, bridged to live gtkx apps over a Unix socket. |
| `@gtkx/testing` | Testing Library-style harness over real GObject widgets: render/cleanup, accessibility-first queries, `userEvent`/`fireEvent` via real GTK controllers/signals, screenshots, all inside React `act()`. |
| `@gtkx/vitest` | Vitest plugin provisioning per-worker headless display isolation and wiring the gtkx config virtual module identically to production. |
| `@gtkx/e2e` | Private in-repo end-to-end suite exercising the whole framework plus performance benchmarks under the headless harness. |
| `@gtkx/utils` | Dependency-free leaf of pure helpers: string casing, safe source-text/identifier generation, collection helpers, error normalization, graceful-shutdown installer, and the shared structural any-constructor type. |

## Architecture

Each doc below describes a layer's responsibility and how it relates to the others. Read them for the deep picture; do not duplicate their detail here.

- `docs/architecture.md` — the big-picture layer stack and how the layers plus the codegen-emitted binding stores fit together; the orientation hub linking out to every other doc.
- `docs/rendering.md` — the end-to-end render and event pipeline: the reconciler, the wrapper model, prop application and child attachment, the FFI marshalling crossing, and the native GLib-thread mechanics.
- `docs/codegen.md` — the GIR-driven generator: how it consumes introspection data and emits the FFI and JSX binding stores, the reconciler metadata, and the GL bindings, plus freshness handling.
- `docs/cli.md` — the CLI and Vite integration: the command surface, codegen orchestration, the hot-reloading dev supervisor, production bundling, the GTK-asset plugins, and scaffolding.
- `docs/styling.md` — `@gtkx/css` and `@gtkx/animate` (with a pointer to `@gtkx/gl`): the CSS-in-JS pipeline, the process-wide stylesheet bridge, and the Adwaita-driven animation model.
- `docs/mcp.md` — the MCP server: its dual stdio/socket design, the bridge protocol to live apps, and the widget-inspection tool catalog.
- `docs/testing.md` — the testing stack: `@gtkx/vitest` headless display isolation, `@gtkx/testing` render/queries/events/screenshots, act-driven determinism, and the `@gtkx/e2e` suite.
- `docs/build-system.md` — the monorepo tooling: the Turbo task graph with its codegen/native fan-in, the TypeScript project-reference model, the lint/quality gates, and the Vitest workspace and CI.

## Setup and commands

See `README.md` for prerequisites, install, build, running examples, the full command table, and the human-facing gotcha list.

## Working in this repo

- `@gtkx/gi` and `@gtkx/jsx` are generated by `@gtkx/codegen`. Never hand-edit them. To change them, change the codegen emitters or `gtkx.config.ts` and regenerate (`pnpm codegen`).
- The generated type-descriptor vocabulary and the runtime helper names the bindings import form the stable contract between `@gtkx/codegen`, `@gtkx/ffi`, and `@gtkx/native`. Change them in lockstep across all three.
- A clean checkout cannot type-check or build any TS package until the Rust addon is built and codegen has run — these are hard Turbo upstreams.
- All build/test/lint/typecheck/coverage go through Turbo. Run the root scripts (`pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`); do not invoke per-package tools directly when a root script exists.
- TypeScript project references are hand-maintained: each package's `tsconfig.lib.json` references the `tsconfig.lib.json` of every runtime workspace dependency, and its `tsconfig.test.json` references those plus the test-only workspace dependencies. Keep them in sync when you change `package.json` deps.
- All GObject/GTK mutation runs only on the single GLib main-loop thread. Native init runs once as an import side effect and quit is wired to process exit; the runtime is single-lifecycle, so re-init after quit is not supported. Importing `@gtkx/ffi` has side effects (it starts the GLib main loop and registers a process exit handler).
- GTK tests and benches require a headless display (Wayland compositor + software GSK/GL); run them through the headless wrapper, never bare.
- Host node state (parent/children/props/signals) lives in external storage keyed off the wrapper, never on the GObject wrapper itself — go through the state accessors rather than touching the wrapper directly.
- Never use `as unknown as`, the `!` non-null assertion, or `readonly`. No inline comments. American English everywhere.
