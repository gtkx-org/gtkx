# CLI and project workflow

`@gtkx/cli` is the user-facing command-line tool and the Vite integration layer. It scaffolds new apps, runs a hot-reloading dev server, produces a single-file production bundle, and orchestrates GIR/JSX binding generation. It owns the Vite plugins that turn GTK assets (GResources, GSettings schemas, CSS, the native addon) into runnable modules, and an embedded MCP client that lets external tooling drive a live dev app.

For the package map and how the CLI relates to the rest of the stack, see [./architecture.md](./architecture.md). Setup, prerequisites, and the day-to-day commands for humans live in [../README.md](../README.md). This document describes the CLI's architecture and the lifecycle of an app.

## Command tree

The CLI is a single [citty](https://github.com/unjs/citty) command (`gtkx`) with four subcommands. The `bin/gtkx.js` shim runs the compiled command via `runMain`. The package entry (`src/index.ts`) re-exports `defineConfig` (from `@gtkx/config`), `build`, and `createApp` as a library API.

| Subcommand | Module | Responsibility |
| --- | --- | --- |
| `dev` | `commands/dev.ts` | Preflight codegen, then start the dev supervisor over the resolved entry. |
| `build` | `commands/build.ts` | Preflight codegen, then run the production SSR bundle. |
| `codegen` | `commands/codegen.ts` | Generate or refresh the GIR/JSX binding stores (`--force` wipes and regenerates). |
| `create` | `commands/create.ts` | Scaffold a new app from templates, install deps, git-init. |

`commands/entry.ts` resolves the working directory and entry file shared by `dev` and `build`; the entry defaults to `src/index.tsx` relative to the cwd.

## App lifecycle at a glance

```
create  →  scaffold templates, install deps, seed schema env, git init
   │
codegen preflight  →  resolve codegen root + config, sync schema types,
   │                   fingerprint freshness, run @gtkx/codegen if stale
   ├── dev    →  supervisor forks dev-runner child; child runs Vite SSR
   │             server, ssrLoadModule's the entry, Fast Refresh / restart,
   │             embedded MCP client
   └── build  →  vite build in SSR mode → dist/bundle.js + emitted assets
                 (gtkx.node, gtkx.gresource, gschemas.compiled)
```

## Scaffolding (`create`)

`createApp` (`create.ts`) wires `createScaffolder` (`create/scaffolder.ts`) with injected dependencies (`create/deps.ts`: filesystem, `@clack/prompts`, `nypm` for installs, `tinyexec` for git, `nypm` for package-manager detection). The scaffolder is pure logic over that interface, so the prompt/IO surface is swappable for tests.

Flags fill in answers; anything missing is prompted interactively. Options and their validators live in `create/options.ts` — project name must be lowercase letters/digits/hyphens, application id must satisfy `isValidApplicationId` (from `@gtkx/config`), package manager is one of pnpm/npm/yarn, testing is `vitest` or `none`.

Templates live under `templates/` as `*.ejs` files. `templates.ts` lists every template (recursively, relative paths) and renders it through EJS with a `TemplateContext` of `name`, `applicationId`, `title`, and `testing`. The scaffolder maps each template's relative path to a destination:

- Most templates map one-to-one; `gitignore` → `.gitignore`, `config/vitest.config.ts` → `vitest.config.ts`.
- `config/` and `tests/` templates are only emitted when `testing === "vitest"`.

After writing files, the scaffolder installs runtime deps (`@gtkx/css`, `@gtkx/ffi`, `@gtkx/react`, `react`) and dev deps (`@gtkx/cli`, `@types/react`, `typescript`, `vite`, plus `@gtkx/testing`/`vitest` when testing is enabled) via the chosen package manager, seeds an initial empty GSettings env (`node_modules/.gtkx/env.d.ts`) so type-checking works before the first codegen, and git-inits with an initial commit.

The generated `package.json` declares an `imports` map with `#data/*` → `./data/*` and scripts that call `gtkx dev` / `gtkx build`, plus `gtkx codegen && tsc --noEmit` for typecheck.

## Codegen orchestration and freshness

Codegen internals (the GIR repository, the `t.*` descriptor contract, store emission, the fingerprint) live in `@gtkx/codegen` under `packages/codegen/src/`; see the two-store overview in [./architecture.md](./architecture.md). The CLI's job is to decide *where* to run it, *whether* it needs to run, and to delegate to `@gtkx/codegen`'s `CodegenRunner`. This logic lives in `src/codegen/`.

### Where: the codegen root and store

`findCodegenRoot` (`store-resolver.ts`) walks up from the project directory to the nearest ancestor that is both a workspace root (`pnpm-workspace.yaml` or a `workspaces` field) and holds a `gtkx.config.*`. Codegen always runs from that root, not necessarily the invocation cwd, so a monorepo has one authoritative store. When the cwd is a non-root member, its shadowing `.gtkx`/`@gtkx` gi/jsx directories are pruned so the root store wins.

`resolveCodegenStore` computes the store directories under the root's `node_modules`: the content stores at `.gtkx/gi` and `.gtkx/jsx`, and the consumer-facing links at `@gtkx/gi` and `@gtkx/jsx`. It resolves the real install dirs and versions of `@gtkx/ffi`, `@gtkx/native`, `@gtkx/react`, and `react` (falling back to `packages/<name>` inside the root for workspace dev). Those real dirs and versions are passed into `CodegenRunner` so the emitted store can symlink against the actual runtime packages. The JSX store is only generated when both `@gtkx/react` and `react` resolve.

### GIR and library resolution

`gir-resolver.ts` assembles GIR search paths, de-duplicated, from: the config `girPath`, the `GTKX_GIR_PATH` env var (colon-separated), the system `/usr/share/gir-1.0`, and `pkg-config --variable=girdir gobject-introspection-1.0`. An empty result is a hard error pointing at the gobject-introspection packages.

`library-resolver.ts` expands the config `libraries` into concrete `Name-Version` identifiers. Undefined defaults to `Gtk-4.0`. An explicit list that lacks any `Gtk-` entry has `Gtk-4.0` prepended. The wildcard `"*"` discovers `.gir` files across the search paths and keeps the highest version per namespace.

### Whether: fingerprint freshness

`freshness.ts` (`isCodegenNeeded`) decides if regeneration is required without parsing GIR. It returns "needed" when any of the following hold:

- the `.gtkx/gi` store or its `@gtkx/gi` link is missing;
- the store's internal `@gtkx/ffi` / `@gtkx/gi` package links don't resolve;
- a requested library's namespace barrel is missing;
- the JSX store is expected but its link or generated modules (`metadata.js`, `gtk/gtk.js`) are missing;
- the fingerprint sentinel is absent, unparseable, has a different sorted library set, or its recomputed value (over the recorded GIR file contents, libraries, and the serialized user tables from config) no longer matches.

The fingerprint primitives (`computeFingerprint`, `FINGERPRINT_FILENAME`, `serializeUserTables`) come from `@gtkx/codegen`.

### Entry points

`run-codegen.ts` exposes the orchestration surface:

- `runCodegen` — load config from the codegen root, resolve GIR/libraries/store, optionally wipe (force), build a `CodegenRunner`, run it.
- `ensureGenerated` / `preflightCodegen` — resolve the codegen context, sync schema types, and run codegen only when `isCodegenNeeded`. `dev` and `build` call `preflightCodegen`; `GTKX_DISABLE_PREFLIGHT=1` skips it.
- `syncSchemaEnv` — regenerate the GSettings env types (see below); skipped at a bare workspace root.
- `resolveConfigWatch` — return the config file path(s) plus a `regenerate` callback that the dev supervisor watches.

The `codegen` command without `--force` calls `ensureGenerated`; with `--force` it wipes the stores, runs unconditionally, syncs schema types, and prints a report from `report.ts`.

## Configuration: `gtkx.config.ts`

The config schema, validators, loader, and the `virtual:gtkx-config` module are owned by `@gtkx/config` (`packages/config/src/`). It is the connective tissue described in [./architecture.md](./architecture.md): codegen consumes the binding tables, and the reconciler consumes the virtual module at runtime. The relevant contracts for the CLI:

- **Authoring** — `defineConfig` validates every field at module-evaluation time (library identifiers, application-id rules mirroring `g_application_id_is_valid`, the binding-table row shapes) and returns the config unchanged. Top-level options are `libraries`, `girPath`, `applicationId`, and `reactCompiler`, plus the spread `UserTableRows` that extend the JSX binding tables. The repo's own `gtkx.config.ts` is a minimal `{ libraries: [...] }`.
- **Loading** — `loadGtkxConfig` wraps c12 to import `gtkx.config.ts` (rc files, global rc, and package.json sources disabled), re-validating through `defineConfig`. `loadResolvedGtkxConfig` resolves every optional field to a concrete default and swallows only the not-found case (returning an empty resolved config). `createGtkxConfigLoader` memoizes per cwd so one promise is shared.
- **Resolved shape** — `resolveGtkxConfig` normalizes `reactCompiler` into `ResolvedReactCompilerOptions | null` (pinned to the React target) and fills arrays/objects, so downstream code can rely on every key existing.

### Who consumes the config

| Field / output | Consumer |
| --- | --- |
| `libraries`, `girPath` | `library-resolver`, `gir-resolver` for codegen |
| `applicationId` | GResource prefix derivation; the MCP client; the `virtual:gtkx-config` export |
| `reactCompiler` | the `gtkx:react-compiler` Vite plugin |
| `UserTableRows` | merged into codegen's built-in binding tables; fed into the fingerprint |
| resolved config + `@gtkx/jsx/metadata` | the `virtual:gtkx-config` module the reconciler imports |
| `#data/*` imports map | `resolveDataDir`, used by the GResource and GSettings plugins |

The config loader is created once in `gtkxVitePlugins` and shared by the config, gresources, and react-compiler plugins.

## Dev: supervisor + runner

`gtkx dev` is two processes communicating only through a process exit code.

### Supervisor (`dev/supervisor.ts`)

The long-lived parent forks the dev-runner child (`bin/gtkx-dev-runner.js`) with the entry path as its argument. It:

- relaunches the child when it exits with `RELOAD_EXIT_CODE` (`dev/protocol.ts`), and propagates any other exit code;
- watches the config file path(s) returned by `resolveConfigWatch`; on a change it debounces, calls `regenerate` (re-running codegen), then signals the child to exit and relaunches it. A codegen failure keeps the current child running;
- installs graceful shutdown that forwards the signal to the child and force-kills after a timeout.

### Runner (`dev/runner.ts`, child entry `dev/runner-main.ts`)

The child owns the actual app. `runner-main.ts` first prepares a temp compiled-schema directory (see GSettings below), then builds the runner with its default dependency wiring (`dev/runner-deps.ts`) and runs it. The runner logic is pure over an injected `DevRunnerDeps` interface; defaults bind Vite's `createServer`, the refresh runtime, the MCP client, and the application-lifecycle hook.

The execution model is **SSR, not bundled**:

1. `vite-dev-server.ts` builds a middleware-mode (`appType: "custom"`, `server.middlewareMode`) Vite config with the gtkx plugins. Dependency discovery is disabled; `@gtkx/config|react|jsx|animate` and the `.gtkx` stores are kept internal to SSR.
2. The runner `ssrLoadModule`'s the entry. The entry's top-level `createRoot().render()` runs once and mounts the GTK app in Node, with Vite transforming project files on the fly.
3. The app lifecycle hook is installed by `ssrLoadModule`'ing `@gtkx/react` and calling `setApplicationLifecycle`, so an app quit is intercepted (see refresh vs. shutdown below).
4. If the entry mounted a `Gio.Application`, the runner opens the embedded MCP client keyed by the configured (or live) application id.

### Fast Refresh vs. process restart

On a watched file change, the runner invalidates the changed module and its importers, re-`ssrLoadModule`'s it, and asks `isReactRefreshBoundary` whether every export looks like a React component. If so it performs a React Fast Refresh; otherwise it closes the server and exits with `RELOAD_EXIT_CODE`, prompting the supervisor to relaunch.

Two plugins make Fast Refresh work over SSR (`vite-plugins/fast-refresh/`):

- `swcSsrRefresh` transforms project TSX via SWC (automatic runtime, `refresh: true`) for SSR-transformed modules that pass the refresh gate.
- `gtkxRefresh` injects a per-module header binding `$RefreshReg$`/`$RefreshSig$` to `@gtkx/cli/refresh-runtime`, and resolves that runtime specifier.

The shared refresh gate (`internal/vite-refresh-shared.ts`) applies only to SSR transforms matching `/\.[tj]sx?$/` and excluding `node_modules`, `dist`, and `.gtkx`.

A `RefreshTracker` (`dev/refresh-tracker.ts`) marks a refresh in progress. If the app unmounts *during* a refresh, the lifecycle hook treats it as a restart (exit 75) rather than a real quit; an app quit outside a refresh shuts the runner down cleanly.

`gtkxSkipReactDomOptimize` strips `react-dom` from Vite's `optimizeDeps`, since the SSR/GTK target must not pre-bundle it.

## Production build

`builder.ts` (`build`, also a package export) runs `vite build` in SSR mode with `noExternal: true`, bundling everything into `dist/bundle.js` (a single SSR bundle). It adds:

- `gtkxVitePlugins()` (config, gsettings, gresources, assets, react-compiler);
- `gtkxNative` (`vite-plugins/native.ts`) — rejects non-Linux platforms and non-x64/arm64 archs, reads the `@gtkx/native-linux-<arch>-gnu` binding, emits it as `gtkx.node`, and rewrites the native-binding require so the bundle loads the emitted file as an external;
- `gtkxBuiltUrl` (`vite-plugins/built-url.ts`) — rewrites emitted asset URLs. By default they resolve relative to `import.meta.url`; with `--asset-base` they resolve relative to the executable directory (`process.execPath`), for installed-app layouts.

GResource and GSettings plugins emit `gtkx.gresource` and `gschemas.compiled` as build assets (below).

## GTK asset plugins

All asset plugins are `enforce: "pre"` and registered by `gtkxVitePlugins` (`vite-plugins/index.ts`).

### GResources (`vite-plugins/gresources.ts`)

Imports under the `#data/` alias (`DATA_IMPORT_PREFIX`) that resolve to known asset extensions are rewritten to a virtual module that registers a compiled GResource bundle and exports a `resource://` URI plus its `path`. The resource prefix is derived from the application id (`/com/example/app` style), defaulting to `/gtkx/app`. Files are staged into a temp dir and compiled with `glib-compile-resources` into `gtkx.gresource`.

- **Dev** recompiles into a temp staging dir and refreshes the registration when a tracked source changes. The dev init module (rendered by `gresources/render.ts`) re-registers the bundle on `__refresh`, and uses a size/mtime signature (checked in `ensureRegistered`) to skip redundant re-registration.
- **Build** compiles all tracked entries and emits `gtkx.gresource` as an asset; the init module loads and registers it relative to its own URL.

### GSettings (`vite-plugins/gsettings.ts`)

`*.gschema.xml` imports become runtime modules describing schemas and keys (`gsettings/parser.ts` parses, `gsettings/render.ts` renders the runtime module). Schemas are staged under SHA1-derived names (`gsettings/env.ts`) to avoid collisions and compiled with `glib-compile-schemas`.

- **Dev** compiles into a temp dir and prepends it to `GSETTINGS_SCHEMA_DIR`. The dev runner pre-stages this directory before the server starts (`dev/schema-env.ts`, exposing `GTKX_DEV_SCHEMA_DIR`) so the schema dir exists at app start. Schema edits recompile and invalidate the module.
- **Build** compiles all queued schemas into `gschemas.compiled` (emitted as an asset) and injects a bundle banner that points `GSETTINGS_SCHEMA_DIR` at the bundle directory at runtime.

Separately, the plugin keeps a type-only `node_modules/.gtkx/env.d.ts` in sync (`emitSchemaEnv`): one `declare module "#data/..."` per schema file, with typed keys derived from the schema XML, so apps get typed settings. This is also re-synced by `syncSchemaEnv` during codegen preflight, and seeded empty during scaffolding. Schema discovery walks the resolved data dir, skipping dotfile entries.

### CSS (`vite-plugins/assets.ts`)

`*.css` imports are rewritten to a module that calls `injectGlobal` from `@gtkx/css`. The CSS-in-JS pipeline itself lives in `@gtkx/css` under `packages/css/src/` (see the package map in [./architecture.md](./architecture.md)).

### Config (`vite-plugins/config.ts`)

A thin wrapper over `createGtkxConfigPlugin` from `@gtkx/config`, providing the `virtual:gtkx-config` module that fuses the resolved config with `@gtkx/jsx/metadata` for the runtime.

## React compiler (`vite-plugins/react-compiler.ts`)

Transforms project `.ts`/`.tsx` (not `node_modules`, only under the project root) through Babel with `babel-plugin-react-compiler` and the TypeScript preset, using the `reactCompiler` options resolved from config. When `reactCompiler` is `false` the plugin is inert.

## Embedded MCP client

When the dev entry mounts an application, the runner opens a Unix-socket MCP client (`mcp/`) keyed by the application id and answers server-initiated widget commands by driving `@gtkx/testing` against the live widget tree. The MCP server, the dual-server design, the protocol, and the tool catalog live in `@gtkx/mcp` under `packages/mcp/src/` (see the package map in [./architecture.md](./architecture.md)). The runner's role: start the client only when an application id is present, lazily load `@gtkx/testing` through a swappable loader, and stop the client on shutdown.

## Other package exports

- `@gtkx/cli/refresh-runtime` (`refresh-runtime.ts`) — the Fast Refresh runtime the injected header binds to.
- `@gtkx/cli/vitest` (`vitest.ts`) — composes `gtkxVitePlugins` with the `@gtkx/vitest` worker for app test configs; the testing harness and display isolation live in `@gtkx/testing` and `@gtkx/vitest` under `packages/testing/src/` and `packages/vitest/src/` (see [./architecture.md](./architecture.md)).
- `@gtkx/cli/env` — ambient asset/module declarations for `#data/`, CSS, and schema imports.
