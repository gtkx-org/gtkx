# CLI and project workflow

`@gtkx/cli` is the user-facing command-line tool and the Vite integration layer. It scaffolds new apps, runs a hot-reloading dev server, produces a single-file production bundle, and orchestrates GIR/JSX binding generation. It owns the Vite plugins that turn GTK assets (GResources, GSettings schemas, CSS, the native addon) into runnable modules, and an embedded MCP client that lets external tooling drive a live dev app.

For the package map and how the CLI relates to the rest of the stack, see [./architecture.md](./architecture.md). Setup, prerequisites, and the day-to-day commands for humans live in [../README.md](../README.md). This document describes the CLI's responsibilities and the lifecycle of an app.

## Commands

The CLI exposes four subcommands, and a small library API (`defineConfig`, `build`, `createApp`) for embedding the same behavior programmatically.

| Subcommand | Responsibility |
| --- | --- |
| `dev` | Run a codegen freshness check, then start the hot-reloading dev server over the resolved entry. |
| `build` | Run a codegen freshness check, then produce the single-file production bundle. |
| `codegen` | Generate or refresh the GIR/JSX binding stores; a force flag wipes and regenerates unconditionally. |
| `create` | Scaffold a new app from templates, install dependencies, and initialize a git repository. |

`dev` and `build` share entry resolution: the working directory and the entry file (defaulting to a conventional source entry relative to the cwd).

## App lifecycle at a glance

```
create  →  scaffold templates, install deps, seed schema env, git init
   │
codegen preflight  →  resolve codegen root + config, sync schema types,
   │                   check freshness, regenerate if stale
   ├── dev    →  hot-reloading SSR dev server with Fast Refresh and an
   │             embedded MCP client
   └── build  →  single-file SSR bundle plus emitted GTK assets
```

## Scaffolding

`create` renders a set of project templates, fills in interactive answers (any value not supplied as a flag is prompted for, and each answer is validated — project name, application id, package manager, testing choice), then writes the project, installs runtime and dev dependencies through the chosen package manager, seeds an initial empty GSettings type-environment so the project type-checks before its first codegen run, and initializes a git repository with a first commit.

Test-only templates are emitted only when the testing option selects a framework. The scaffolding logic is written against an injected IO interface (filesystem, prompts, installer, process runner) so the prompt/IO surface is swappable in tests.

## Codegen orchestration and freshness

Codegen itself — the GIR repository, the Type descriptor contract, store emission, and the fingerprint — lives in `@gtkx/codegen`; see [./codegen.md](./codegen.md). The CLI's job is to decide *where* to run it, *whether* it needs to run, and to delegate to the generator.

**Where.** The CLI walks up from the project directory to the nearest ancestor that is both a workspace root and holds a `gtkx.config`, and runs codegen from there so a monorepo has one authoritative binding store. The generated store is placed under that root and surfaced to consumers through stable package links; when invoked from a non-root member, any shadowing copies of the generated packages are pruned so the root store wins. The store links against the actual resolved runtime packages (the FFI runtime, the native addon, the React layer, and `react`), and the JSX bindings are generated only when the React layer and `react` both resolve.

**GIR and libraries.** The CLI assembles the GIR search paths from config, an environment override, and the system introspection directories, and expands the configured library list into concrete versioned namespace identifiers — defaulting to GTK 4, ensuring GTK is always present, and supporting a wildcard that discovers every available namespace at its highest version. An empty search path is a hard error pointing at the introspection packages.

**Whether.** A freshness check decides if regeneration is required without parsing GIR. Regeneration is triggered when the generated store or its consumer links are missing or unresolvable, when a requested namespace is absent from the store, when the expected JSX bindings are missing, or when a recorded fingerprint is absent, unparseable, or no longer matches a value recomputed over the GIR inputs, the library set, and the user-supplied configuration. `dev` and `build` run this check before starting (it can be disabled by an environment flag); the `codegen` command runs it directly, or skips it and regenerates unconditionally under the force flag.

## Configuration: `gtkx.config.ts`

The config schema, validators, loader, and the `virtual:gtkx-config` module are owned by `@gtkx/config`. It is the connective tissue described in [./architecture.md](./architecture.md): codegen consumes the binding tables, and the reconciler consumes the virtual module at runtime. From the CLI's perspective:

- **Authoring** — `defineConfig` validates every field when the config module evaluates (library identifiers, the application-id rules, and any binding-table extensions) and returns the config unchanged. The top-level options cover the target libraries, the GIR search path, the application id, the React compiler toggle, and optional extensions to the JSX binding tables.
- **Loading** — the loader imports `gtkx.config.ts` in isolation (external rc and package.json sources disabled), re-validates it, resolves every optional field to a concrete default, and tolerates a missing config by returning an empty resolved config. Loading is memoized per working directory so plugins share one result.

### Who consumes the config

| Field / output | Consumer |
| --- | --- |
| target libraries, GIR search path | codegen library and GIR resolution |
| application id | GResource prefix derivation, the MCP client, and the config virtual module |
| React compiler options | the React-compiler Vite plugin |
| binding-table extensions | merged into codegen's built-in tables and folded into the freshness fingerprint |
| resolved config + JSX metadata | the `virtual:gtkx-config` module the reconciler imports |
| data-imports map | the GResource and GSettings plugins |

## Dev: hot-reloading SSR server

`gtkx dev` runs as a long-lived supervisor process and a child runner that owns the app, communicating only through the child's exit code. The supervisor relaunches the child on a reload exit code and propagates any other code, watches the config file(s) and — on a change — debounces, regenerates the bindings, and restarts the child (a codegen failure leaves the running child untouched), and installs graceful shutdown that forwards signals to the child.

The execution model is server-side rendering, not bundling. The runner starts Vite in middleware mode with the gtkx plugins, keeps the gtkx runtime packages and the generated stores internal to SSR rather than pre-bundled, then SSR-loads the entry. The entry's top-level render runs once and mounts the GTK app directly in Node, with Vite transforming project files on demand. The runner installs an application-lifecycle hook so an app quit can be distinguished from a hot-reload remount, and — once an application is mounted — opens the embedded MCP client keyed by the application id.

**Fast Refresh vs. restart.** On a watched file change, the runner re-loads the changed module and its importers and checks whether every export looks like a React component. If so it performs a React Fast Refresh in place; otherwise it tears down the server and exits with the reload code so the supervisor relaunches a clean process. Fast Refresh over SSR is enabled by plugins that transform project TSX with the refresh runtime and bind the per-module refresh registration to a runtime shipped by the CLI; the transform applies only to project source, excluding dependencies, build output, and the generated stores. A remount that happens *during* a refresh is treated as a restart rather than a real app quit.

## Production build

`build` runs Vite in SSR mode with nothing externalized, producing a single self-contained bundle plus emitted GTK assets. Beyond the shared asset plugins, the build:

- resolves the prebuilt native addon for the host platform/arch, emits it alongside the bundle, and rewrites the native binding so the bundle loads it as an external file (non-Linux platforms and unsupported architectures are rejected);
- rewrites emitted asset URLs so they resolve relative to the bundle by default, or relative to the executable directory when targeting an installed-app layout.

## GTK asset plugins

The asset plugins run before other Vite transforms and are registered together. Each turns a kind of GTK asset into a module the app can import.

### GResources

Imports under the data alias that resolve to known asset extensions are rewritten to a virtual module that registers a compiled GResource bundle and exports its `resource://` URI and path. The resource prefix is derived from the application id. In dev the bundle is compiled into a temporary staging directory and re-registered when a tracked source changes, skipping redundant re-registration via a size/mtime signature; in build the bundle is compiled once and emitted as a build asset that the init module loads relative to its own URL.

### GSettings

Schema XML imports become runtime modules describing schemas and keys, staged under collision-free names and compiled with the GLib schema compiler. In dev the compiled schemas are written to a temporary directory that the runner pre-stages before the server starts and prepends to the schema search path, recompiling on edits; in build all schemas are compiled into a single emitted asset and the bundle is given a banner that points the schema search path at the bundle directory at runtime.

Separately, the plugin keeps a type-only declaration file in sync — one typed module per schema, with keys derived from the schema XML — so apps get typed settings. This declaration is also re-synced during codegen preflight and seeded empty during scaffolding.

### CSS

CSS imports are rewritten to a module that injects the stylesheet through `@gtkx/css`. The CSS-in-JS pipeline itself lives in `@gtkx/css`; see [./styling.md](./styling.md).

### Config

A thin wrapper over the config plugin from `@gtkx/config`, providing the `virtual:gtkx-config` module that fuses the resolved config with the JSX metadata for the runtime.

## React compiler

A plugin transforms project source through the React compiler using the options resolved from config, scoped to the project root and excluding dependencies. When the React compiler is disabled in config the plugin is inert.

## Embedded MCP client

When the dev entry mounts an application, the runner opens a Unix-socket MCP client keyed by the application id and answers server-initiated widget commands by driving `@gtkx/testing` against the live widget tree. The client starts only when an application id is present, lazily loads the testing harness, and stops on shutdown. The server, the dual-server design, the protocol, and the tool catalog live in `@gtkx/mcp`; see [./mcp.md](./mcp.md).

## Other package exports

- A Fast Refresh runtime that the injected refresh header binds to.
- A Vitest entry that composes the gtkx Vite plugins with the `@gtkx/vitest` worker for app test configs; the testing harness and headless display isolation live in `@gtkx/testing` and `@gtkx/vitest` (see [./testing.md](./testing.md)).
- Ambient module declarations for the data, CSS, and schema imports.
