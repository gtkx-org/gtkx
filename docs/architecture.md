# Architecture overview

gtkx builds native GTK4 / libadwaita desktop applications with React, TypeScript, and JSX. App authors write declarative JSX whose element types are GTK widget names and use GObject-aware hooks; a custom `react-reconciler` maps that tree to live GObject instances, and a Rust napi addon owns the single GLib main-loop thread and performs every libffi call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into the typed bindings, JSX element types, and reconciler metadata the runtime consumes, and a Vite-based CLI provides scaffolding, hot-reloading development, single-file production bundling, and GTK-asset integration.

This page is the orientation hub. It describes the layers and the package map, then points at the package source trees that own each subsystem's mechanics.

## The layered stack

A React element tree becomes live widgets by descending through five layers, every native operation funneling onto one GLib thread:

```
React application (JSX + GObject-aware hooks)
        │  element types are GTK widget names
        ▼
@gtkx/react  ── react-reconciler host config (mutation mode)
        │  GObject construction, prop/signal/child application
        ▼
@gtkx/ffi    ── GObject-shaped operations over descriptor primitives
        │  the t.* type-descriptor DSL, GValue marshalling, registry
        ▼
@gtkx/native ── Rust napi addon: single gtkx-glib thread + libffi
        │  dlopen by name, descriptor-driven Type enum, toggle refs
        ▼
System GTK4 / GLib / libadwaita  (shared libraries, resolved dynamically)
```

- **React application.** App code describes the UI with GTK widget element types from `@gtkx/jsx` and drives state through ordinary React hooks plus GObject-aware ones (`useProperty`, `useSignal`, `useSetting`, `useApplication`). `createRoot()` returns a root whose `render(<App/>)` mounts the tree onto a `RootElement` — the reconciler's virtual root, created internally by default rather than a GTK container the caller supplies. Top-level GTK windows come from rendering `Application` and top-level components within that tree.
- **`@gtkx/react`.** A `react-reconciler` host config running in mutation mode. It resolves each JSX element type name to a registered GObject wrapper class, applies props as GObject property writes, signal connections, or imperative method calls (all driven by generated config tables), and translates React tree mutations into GTK parent/child attachment through an ordered set of `ElementMapping` strategies. It also ships the higher-level components (Application, list/menu/constraint families) and the hooks.
- **`@gtkx/ffi`.** Hand-written TypeScript that turns the native addon's untyped, descriptor-driven primitives into GObject-shaped operations: object construction, GValue marshalling in both directions, signal connect/emit with trampolined callbacks, subclass and vfunc registration, and a bidirectional GType-to-JS-class registry plus handle and wrapper-identity bookkeeping. It exposes the `t.*` type-descriptor DSL that generated code targets.
- **`@gtkx/native`.** A napi-rs Rust module that bridges Node to GTK at the C ABI. It serializes all GLib/GTK work onto one dedicated `gtkx-glib` thread through a Mailbox, builds libffi CIFs to call arbitrary C symbols resolved by name, marshals values per a descriptor-driven `Type` enum, registers JS-backed GObject subclasses, and keeps JS wrappers and native GObjects mutually alive through toggle references. It dlopens GTK/GLib by name, so it is GTK-version-agnostic.
- **System libraries.** The actual `libgobject-2.0`, `libgtk-4`, `libadwaita`, `libGL`, and related shared objects, loaded dynamically at call time.

The full render and event pipeline — host-node model, prop application, attachment, text and list subsystems, the FFI crossing, and the native thread/Mailbox/trampoline/toggle-ref mechanics — lives in the reconciler under `packages/react/src/reconciler/`, the runtime under `packages/ffi/src/`, and the Rust addon under `packages/native/`.

## Two generated stores

`@gtkx/codegen` is the build-time generator that owns the contract the runtimes consume. It loads the transitive closure of requested GIR libraries into an arena type model, then emits two binding stores plus an offline OpenGL module:

- **`@gtkx/gi`** — low-level FFI bindings, one module per GIR namespace (classes, interfaces, enums, boxed types, functions, constants), each entity expressed as a `t.*` descriptor expression and registered with the runtime registry. Hand-written template overrides supplement the generated code.
- **`@gtkx/jsx`** — React bindings: intrinsic element constants, per-widget `Props` interfaces, compound components, the JSX intrinsic-elements augmentation, and a metadata module baking every reconciler table (element map, prop rules, signals, construct props, defaults).

Both stores are transpiled to JS plus declarations, assembled with a package manifest and relative symlinks to the real runtime packages, and atomically swapped into place under `node_modules/.gtkx` so they resolve as real installed packages. The `t.*` descriptor vocabulary and the imported helper names are the stable boundary `@gtkx/ffi` and `@gtkx/native` must implement. Codegen mechanics — the repository model, store emission, the atomic swap, fingerprint freshness, and the Khronos GL path — live under `packages/codegen/src/`.

## Package map

The repository is a pnpm workspace (see `pnpm-workspace.yaml`) of TypeScript packages plus one Rust addon, under `packages/`:

| Package | Role |
| --- | --- |
| `@gtkx/native` | Rust napi addon: owns the single GLib thread, runs all libffi C calls, marshals via a descriptor `Type` enum, registers JS subclasses/vfuncs, binds wrapper lifetime via toggle references. |
| `@gtkx/ffi` | TS runtime over the addon: GObject construction, GValue marshalling, signals/trampolines, the GType↔class registry, and the `t.*` descriptor DSL. |
| `@gtkx/react` | Custom `react-reconciler` host config mapping JSX to GObject instances, plus higher-level components and GObject-aware hooks. |
| `@gtkx/codegen` | GIR/Khronos generator producing the `@gtkx/gi` and `@gtkx/jsx` stores, the reconciler metadata, and `@gtkx/gl`. |
| `@gtkx/cli` | User-facing CLI and Vite integration: scaffolding, hot-reloading dev, production bundling, codegen orchestration, GTK-asset plugins, embedded MCP client. |
| `@gtkx/config` | Single source of truth for `gtkx.config.ts`: schema, loading/resolution, binding-table rule schema, and the Vite plugin emitting the `virtual:gtkx-config` module. |
| `@gtkx/gi` | Generated low-level FFI bindings (one module per namespace) plus template overrides. |
| `@gtkx/jsx` | Generated React/JSX bindings and the reconciler metadata module. |
| `@gtkx/css` | Emotion-based CSS-in-JS compiling tagged-template styles into GTK CSS classes via a process-wide `CssProvider`. |
| `@gtkx/animate` | React animation components (`AdwTimedAnimation`, `AdwSpringAnimation`, `AnimatePresence`) driven by libadwaita animations. |
| `@gtkx/gl` | Hand-curated OpenGL core bindings generated from the Khronos registry, for use in `GtkGLArea` render callbacks. |
| `@gtkx/mcp` | Model Context Protocol server exposing widget-inspection/interaction tools, bridged to live apps over a Unix socket. |
| `@gtkx/testing` | Testing Library-style harness operating on real GObject widgets: render/cleanup, accessibility-first queries, `userEvent`/`fireEvent`, screenshots. |
| `@gtkx/vitest` | Vitest plugin provisioning per-worker headless display isolation and the gtkx config virtual module. |
| `@gtkx/e2e` | Private in-repo end-to-end suite and performance benchmarks under the headless harness. |
| `@gtkx/utils` | Dependency-free leaf of pure helpers (string casing, collection helpers, the `AnyClass` type). |

`@gtkx/config` deserves a note as the connective tissue: it is the single source of truth for `gtkx.config.ts` and exposes the `virtual:gtkx-config` module that fuses resolved config fields with the codegen-emitted metadata, which the reconciler reads at runtime. Examples that exercise the whole stack live under `examples/*`.

## How codegen and the build graph relate

Turbo orchestrates the workspace into a cache-aware task graph (see `turbo.json`), with TypeScript project references mirroring workspace dependencies. Two fan-in roots gate almost everything:

- **`native-build`** compiles the Rust napi addon to per-platform `.node` binaries and the native binding glue.
- **`@gtkx/cli#codegen`** runs the CLI's codegen to emit the `@gtkx/gi` / `@gtkx/jsx` stores under `node_modules/.gtkx`.

`@gtkx/cli#codegen` itself `dependsOn` `native-build` (codegen loads the addon to resolve GTypes), and the build, typecheck, and test tasks of the runtime packages `dependsOn` both. A clean checkout therefore cannot type-check or build any TS package until the addon is compiled and codegen has produced `.gtkx`. The Turbo task graph and the project-reference model are defined in `turbo.json` and the `tsconfig.*.json` files at the repository root.

## Where to go next

- [rendering.md](./rendering.md) — the end-to-end render and event pipeline, from reconciler host config to native libffi call and back (`packages/react/src/reconciler/`, `packages/ffi/src/`, `packages/native/`).
- [codegen.md](./codegen.md) — the GIR-driven generator, the runtime↔generated contract, the two stores, and the GL path (`packages/codegen/src/`).
- [cli.md](./cli.md) — the CLI command tree, dev supervisor and SSR Fast Refresh, production bundling, and GTK-asset Vite plugins (`packages/cli/src/`).
- [styling.md](./styling.md) — `@gtkx/css`, `@gtkx/animate`, and the `@gtkx/gl` OpenGL bindings (`packages/css/src/`, `packages/animate/src/`, `packages/gl/src/`).
- [mcp.md](./mcp.md) — the MCP server, its socket bridge, and the embedded dev-runner client (`packages/mcp/src/`).
- [testing.md](./testing.md) — per-worker display isolation and the testing harness (`packages/vitest/src/`, `packages/testing/src/`).
- [build-system.md](./build-system.md) — the Turbo task graph, TypeScript project references, and the quality gates.

Setup, prerequisites, and the day-to-day commands for humans live in [../README.md](../README.md).
