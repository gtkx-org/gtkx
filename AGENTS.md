# CLAUDE.md

GTKX is a framework for building native GTK4/libadwaita desktop applications with React, TypeScript, and JSX. App authors write declarative JSX whose element types are GTK widget names; a custom react-reconciler maps that tree to live GObject instances, while a Rust napi addon owns the single GLib main-loop thread and performs every libffi call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into the typed bindings, JSX element types, and reconciler metadata the runtime consumes, and a Vite-based CLI provides scaffolding, hot-reloading dev, single-file production bundling, and GTK-asset integration.

Homepage: https://gtkx.dev

## Packages

| Package | Role |
| --- | --- |
| `@gtkx/native` | Rust napi addon: owns the single GLib main-loop thread, performs all libffi C calls into GTK/GObject, marshals values via the Type descriptor contract, registers JS-backed subclasses/vfuncs, binds wrapper lifetime to native GObjects. |
| `@gtkx/ffi` | Hand-written TS runtime over the addon: GObject construction, value marshalling, signals and trampolines, subclass registration, the GType-to-class registry and wrapper identity, and the Type descriptor vocabulary the generated bindings target. |
| `@gtkx/react` | Custom react-reconciler host config mapping JSX to GObject instances, plus the GObject-aware hooks; drives prop application, child attachment, and the commit freeze/signal-block strategy. |
| `@gtkx/components` | Hand-written higher-level component families (list, grid, fixed, overlay, column, drop-down, menu, combo-row, dialog, constraint layout) over the generated bindings. |
| `@gtkx/codegen` | Build-time GIR/Khronos generator producing the `@gtkx/gi` and `@gtkx/jsx` binding stores, the reconciler metadata, and `@gtkx/gl`; owns the Type descriptor and helper-name contract the runtimes implement. |
| `@gtkx/cli` | User-facing CLI and Vite integration: hot-reloading dev supervisor over SSR with Fast Refresh, single-file production bundling, codegen orchestration with freshness checks, the GTK-asset Vite plugins, and the embedded MCP client. |
| `@gtkx/config` | Single source of truth for `gtkx.config.ts`: schema, validation, loading and resolution, the elementProps schema, the wrapper-protocol constants, and the Vite plugin that emits the `virtual:gtkx-config` module fusing resolved config with codegen metadata. |
| `create-gtkx` | The `create` scaffolder: renders project templates, installs dependencies, and initializes a git repository; the CLI's `create` subcommand delegates here. |
| `@gtkx/gi` | Generated low-level FFI bindings: one module per GIR namespace plus hand-written overrides; resolves as a real installed package via codegen symlinks. |
| `@gtkx/jsx` | Generated React/JSX bindings: intrinsic element types, per-widget prop interfaces, compound components, the JSX intrinsic-elements augmentation, and the reconciler metadata module. |
| `@gtkx/css` | Emotion-based CSS-in-JS that compiles tagged-template styles into GTK CSS classes pushed through a process-wide CSS provider; raw global stylesheet injection; supports GTK `@named-colors`. |
| `@gtkx/animate` | React animation components (tween/spring transitions and presence-aware enter/exit) that interpolate opacity/transform via libadwaita animations and write them out as per-element GTK CSS. |
| `@gtkx/gl` | Hand-curated OpenGL core bindings generated from the vendored Khronos registry plus companion helpers, for use inside GL-area render callbacks. |
| `@gtkx/mcp` | Model Context Protocol server exposing widget-inspection/interaction tools to AI agents over stdio, bridged to live GTKX apps over a Unix socket. |
| `@gtkx/testing` | Testing Library-style harness over real GObject widgets: render/cleanup, accessibility-first queries, `userEvent`/`fireEvent` via real GTK controllers/signals, screenshots, all inside React `act()`. |
| `@gtkx/vitest` | Vitest plugin provisioning per-worker headless display isolation and wiring the GTKX config virtual module identically to production. |
| `@gtkx/e2e` | Private in-repo end-to-end suite exercising the whole framework plus performance benchmarks under the headless harness. |
| `@gtkx/utils` | Dependency-free leaf of pure helpers: string casing, safe source-text/identifier generation, collection helpers, error normalization, graceful-shutdown installer, and the shared structural any-constructor type. |

## Working in this repo

- Never use `as unknown as`, the `!` non-null assertion, or `readonly`. Do not add comments or docs. American English everywhere.
- A new source file must earn its existence: it holds a substantial, cohesive responsibility with no natural home in an existing module. Do not create a file for a trivial or single-item unit — a lone small helper, a thin wrapper around one call, a re-export shim, or a placeholder for code that doesn't exist yet. Put such code in the existing module it belongs to and extend that file. Breaking an import cycle or extracting for reuse justifies relocating code into a suitable existing module.
