# Architecture overview

gtkx builds native GTK4 / libadwaita desktop applications with React, TypeScript, and JSX. App authors write declarative JSX whose element types are GTK widget names and drive state with ordinary React hooks plus GObject-aware ones; a custom `react-reconciler` maps that tree to live GObject instances, and a Rust napi addon owns the single GLib main-loop thread and performs every C call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into the typed bindings, JSX element types, and reconciler metadata the runtime consumes, and a Vite-based CLI provides scaffolding, hot-reloading development, single-file production bundling, and GTK-asset integration.

This page is the orientation hub. It describes the layers and the package map, then points at the docs and source trees that own each subsystem's mechanics.

## The layered stack

A React element tree becomes live widgets by descending through a stack of layers, with every native operation funneled onto one GLib thread:

```
React application (JSX + GObject-aware hooks)
        │  element types are GTK widget names
        ▼
@gtkx/react  ── react-reconciler host config
        │  GObject construction, prop/signal/child application
        ▼
@gtkx/ffi    ── GObject-shaped operations over Type descriptors
        ▼
@gtkx/native ── Rust napi addon: single GLib thread + libffi
        ▼
System GTK4 / GLib / libadwaita  (shared libraries, resolved dynamically)
```

- **React application.** App code describes the UI with GTK widget element types and drives state through ordinary React hooks plus GObject-aware ones that read and write GObject properties, connect signals, and reach application and settings state. A root object mounts the tree; top-level GTK windows come from rendering an application component and its children.
- **`@gtkx/react`.** A `react-reconciler` host config. It resolves each JSX element type to a registered GObject wrapper class, applies props as GObject property writes, signal connections, or imperative method calls, and translates React tree mutations into GTK parent/child attachment. The mapping of element types, props, signals, and attachment rules is supplied by the generated metadata, not hand-coded per widget. This package also owns the GObject-aware hooks.
- **`@gtkx/components`.** Hand-written higher-level components — list, grid, column, drop-down, menu, and constraint-layout families — built over the generated bindings, presenting React-idiomatic abstractions for GTK widget families whose raw APIs are imperative or list-model driven.
- **`@gtkx/ffi`.** Hand-written TypeScript that turns the native addon's descriptor-driven primitives into GObject-shaped operations: object construction, value marshalling in both directions, signal connect and emit, subclass and vfunc registration, and the registry that maps GTypes to JS classes and keeps wrapper identity. It exposes the Type-descriptor vocabulary that the generated bindings target.
- **`@gtkx/native`.** A Rust napi addon that bridges Node to GTK at the C ABI. It serializes all GLib/GTK work onto one dedicated GLib thread, calls C symbols resolved by name through libffi trampolines, marshals values according to the Type descriptor each call carries, registers JS-backed GObject subclasses, and keeps JS wrappers and native GObjects mutually alive. It loads GTK/GLib dynamically by name, so it is not bound to a specific GTK version.
- **System libraries.** The actual GObject, GTK, libadwaita, OpenGL, and related shared objects, loaded dynamically at call time.

The full render and event pipeline — the host-node model, prop application, attachment, the text and list subsystems, the FFI crossing, and the native thread and lifetime mechanics — is documented in [rendering.md](./rendering.md).

## Two generated stores

`@gtkx/codegen` is the build-time generator that owns the contract the runtimes consume. It loads the transitive closure of requested GIR libraries into an in-memory type model, then emits two binding stores plus an offline OpenGL module:

- **`@gtkx/gi`** — low-level FFI bindings, one module per GIR namespace (classes, interfaces, enums, boxed types, functions, constants), each entity expressed as a Type descriptor and registered with the runtime. Hand-written overrides supplement the generated code.
- **`@gtkx/jsx`** — React bindings: the intrinsic element types, per-widget prop interfaces, compound components, the JSX intrinsic-elements augmentation, and the metadata that bakes every reconciler table (element mapping, prop rules, signals, construct properties, defaults).

Both stores are transpiled to JS plus declarations and assembled so they resolve as real installed packages, with symlinks back to the runtime packages they depend on. The Type descriptor vocabulary and the imported helper names are the stable boundary that `@gtkx/ffi` and `@gtkx/native` implement and that `@gtkx/codegen` emits against; the three move in lockstep. Codegen mechanics are documented in [codegen.md](./codegen.md).

## Package map

The repository is a pnpm workspace of TypeScript packages plus one Rust addon:

| Package | Role |
| --- | --- |
| `@gtkx/native` | Rust napi addon: owns the single GLib thread, runs all libffi C calls, marshals via Type descriptors, registers JS subclasses/vfuncs, binds wrapper lifetime to native GObjects. |
| `@gtkx/ffi` | TS runtime over the addon: GObject construction, value marshalling, signals and trampolines, the GType-to-class registry, and the Type descriptor vocabulary. |
| `@gtkx/react` | Custom `react-reconciler` host config mapping JSX to GObject instances, plus the GObject-aware hooks. |
| `@gtkx/components` | Hand-written higher-level component families (list, grid, column, drop-down, menu, constraint layout) over the generated bindings. |
| `@gtkx/codegen` | GIR/Khronos generator producing the `@gtkx/gi` and `@gtkx/jsx` stores, the reconciler metadata, and `@gtkx/gl`. |
| `@gtkx/cli` | User-facing CLI and Vite integration: hot-reloading dev, production bundling, codegen orchestration, GTK-asset plugins, embedded MCP client. |
| `create-gtkx` | The `create` scaffolder the CLI delegates to: renders project templates, installs dependencies, and initializes a git repository. |
| `@gtkx/config` | Single source of truth for the project config file: schema, loading and resolution, the binding-table rule schema, and the Vite plugin that exposes resolved config plus codegen metadata as a virtual module. |
| `@gtkx/gi` | Generated low-level FFI bindings (one module per namespace) plus overrides. |
| `@gtkx/jsx` | Generated React/JSX bindings and the reconciler metadata module. |
| `@gtkx/css` | Emotion-based CSS-in-JS compiling tagged-template styles into GTK CSS classes via a process-wide CSS provider. |
| `@gtkx/animate` | React animation components (`TimedAnimation`, `SpringAnimation`, `AnimatePresence`) driven by libadwaita animations. |
| `@gtkx/gl` | Hand-curated OpenGL core bindings generated from the Khronos registry, for use in GL-area render callbacks. |
| `@gtkx/mcp` | Model Context Protocol server exposing widget-inspection/interaction tools, bridged to live apps over a Unix socket. |
| `@gtkx/testing` | Testing Library-style harness operating on real GObject widgets: render/cleanup, accessibility-first queries, `userEvent`/`fireEvent`, screenshots. |
| `@gtkx/vitest` | Vitest plugin provisioning per-worker headless display isolation and the gtkx config virtual module. |
| `@gtkx/e2e` | Private in-repo end-to-end suite and performance benchmarks under the headless harness. |
| `@gtkx/utils` | Dependency-free leaf of pure helpers (string casing, collection helpers, shared structural types). |

`@gtkx/config` is the connective tissue: it is the single source of truth for the project config file and exposes a virtual module fusing resolved config with the codegen-emitted metadata, which the reconciler reads at runtime. Examples that exercise the whole stack live under `examples/`.

## How codegen and the build graph relate

Turbo orchestrates the workspace into a cache-aware task graph, with TypeScript project references mirroring workspace dependencies. Two fan-in roots gate almost everything:

- **Native build** compiles the Rust napi addon to per-platform binaries.
- **Codegen** emits the `@gtkx/gi` and `@gtkx/jsx` stores so they resolve as installed packages.

Codegen depends on the native build, because it loads the addon to resolve GTypes; the build, typecheck, and test tasks of the runtime packages depend on both. A clean checkout therefore cannot type-check or build any TS package until the addon is compiled and codegen has produced the stores. The task graph and project-reference model are documented in [build-system.md](./build-system.md).

## Where to go next

- [rendering.md](./rendering.md) — the end-to-end render and event pipeline, from reconciler host config to native C call and back.
- [codegen.md](./codegen.md) — the GIR-driven generator, the runtime-to-generated contract, the two stores, and the GL path.
- [cli.md](./cli.md) — the CLI command tree, the dev supervisor and SSR Fast Refresh, production bundling, and the GTK-asset Vite plugins.
- [styling.md](./styling.md) — `@gtkx/css`, `@gtkx/animate`, and the `@gtkx/gl` OpenGL bindings.
- [mcp.md](./mcp.md) — the MCP server, its socket bridge, and the embedded dev-runner client.
- [testing.md](./testing.md) — per-worker display isolation and the testing harness.
- [build-system.md](./build-system.md) — the Turbo task graph, TypeScript project references, and the quality gates.

Setup, prerequisites, and the day-to-day commands for humans live in [../README.md](../README.md).
