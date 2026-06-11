# AGENTS.md

Guidance for AI coding agents and contributors working in this repository.

GTKX builds native Linux GTK4 desktop apps with React 19. A custom React reconciler renders to real GObject widgets through a hand-written FFI layer backed by a Rust napi-rs native module. TypeScript bindings for GTK/GLib libraries are generated from GObject Introspection (GIR) XML by a codegen pipeline.

This is a pnpm + turbo monorepo. Node >= 24 and pnpm 11 are required.

## Commands

Run everything from the repo root unless noted. Turbo resolves task ordering (codegen and native build run before TypeScript builds automatically).

```bash
pnpm install                 # install workspace deps
pnpm build                   # build all packages (turbo build --filter=!gtkx)
pnpm test                    # run all package tests (turbo)
pnpm test:all                # aggregate vitest suite directly (resolves @gtkx/* to TS source; needs codegen output + native .node present)
pnpm typecheck               # tsc -b --emitDeclarationOnly across packages
pnpm lint                    # biome + knip + depcruise + cargo fmt/clippy
pnpm codegen                 # regenerate GIR-derived bindings into node_modules/.gtkx
pnpm coverage                # TS (v8) + Rust (llvm-cov, 100% line/function) coverage
pnpm docs                    # build TypeDoc API + VitePress website
```

Per-package and single-test runs:

```bash
pnpm --filter @gtkx/ffi test                              # one package's tests
pnpm --filter @gtkx/ffi exec vitest run tests/foo.test.ts # a single test file
pnpm --filter @gtkx/ffi typecheck                         # typecheck one package
```

Rust native module (`packages/native`):

```bash
pnpm --filter @gtkx/native native-build                   # build the .node binary
cd packages/native && xvfb-run -a cargo test -- --test-threads=1   # Rust tests (need a display, single-threaded)
cd packages/native && cargo fmt --check && cargo clippy -- -D warnings
```

Memory and marshalling safety checks live in `scripts/`: `ci-asan.sh` (AddressSanitizer), `ci-miri.sh` (Miri over the marshalling hot path), `ci-bench.sh` (CodSpeed benchmarks).

App-level CLI (inside an app such as `examples/hello-world`):

```bash
gtkx create my-app   # scaffold a new app
gtkx dev             # Vite dev server with React Fast Refresh
gtkx build           # produce dist/bundle.js + dist/gtkx.node
node dist/bundle.js  # run the production build
```

## Architecture

The core runtime is four layers, top to bottom. A React tree mutation flows down to a GTK widget call.

1. **`@gtkx/react` — reconciler.** A `react-reconciler` host config (`packages/react/src/host-config.ts`) maps every tree operation onto plain `Instance` records (`packages/react/src/instance.ts`), each wrapping a backing GObject. Attach/detach dispatch is table-driven: serializable rows in the shapes `@gtkx/config` declares arrive pre-merged through `virtual:gtkx-config` (codegen's built-ins followed by the project's `elementMap`/`arrayProps`/`objectProps`/`virtualProps` config rows) and are interpreted by `attach-rules.ts`, `array-props.ts`, and the prop-descriptor layer (object props run CallSteps from one object value; virtual props forward a value to a setter, e.g. `drawFunc` → `setDrawFunc`), while stateful relationships (slots, overlays, stack pages, the widget-container fallback) stay hand-written interpreters in `element-map.ts`. Recursive or controller-shaped item ownership lives in hand-written runtime components, never in the reconciler: the list family owns its `items` through `ListController`, and `GMenu` rebuilds its value-snapshot model from the `items` entry tree (`components/menu.tsx`). Non-container relationships are slot/container-slot props on the parent element, not children — `addController`, `insertActionGroup`, and `layoutManager` on every widget, `addShortcut` on shortcut controllers, `addAction` on application windows, `dialog` on the dialog buttons — resolved per element by `createWidgetComponent` (`packages/react/src/create-widget-component.ts`), the factory behind every generated component, which walks the element's GType ancestry against the merged `SLOTS`/`CONTAINER_SLOTS` tables and splits those props into metadata wrapper children; nesting such an element as a child throws an error naming the prop. `applyProps` (`packages/react/src/nodes/internal/apply-props.ts`) diffs props into GObject property sets, signal connections, and prop-rule descriptors. `SignalStore` (`packages/react/src/nodes/internal/signal-store.ts`) owns all signal connections per root and, during a commit, suppresses blockable signal handlers except lifecycle signals (realize/map/destroy, etc.), which still fire. `@gtkx/react` never imports `@gtkx/jsx` or the optional `@gtkx/gi` namespaces, even type-only — `.dependency-cruiser.cjs` enforces this with `tsPreCompilationDeps` — and its shared prop shapes live in `element-props.ts`, which the generated Props interfaces extend.

2. **`@gtkx/ffi` — FFI runtime.** Hand-written glue that generated bindings call into. Owns GObject construction (`constructGObjectInstance` in `object.ts`), identity/wrapper registry (`registry.ts`), opaque handle mapping (`handles.ts`), GValue marshalling (`value-marshal.ts`), GObject type-system resolution (`gtype.ts`), signal connection (`signals.ts`), and the near-allocation-free `t.fn` call factory (`helpers.ts`).

3. **`@gtkx/native` — Rust napi-rs module.** Exposes low-level FFI primitives (`call`, `alloc`, `read`, `write`), wrapper/toggle-reference management, and `freeze`/`unfreeze`. All GTK/GLib calls run on a dedicated GLib thread; the JS thread and GLib thread communicate through a `Mailbox` (`packages/native/src/dispatch.rs`). During a React commit, `freeze` drains mutations without yielding to the frame clock so the commit appears atomic to GTK. Toggle references (`toggle_ref.rs`) unify JS-wrapper GC with GObject refcounting.

4. **GTK4 / GLib** via libffi, resolved by symbol from the system libraries listed in `gtkx.config.ts`.

**`@gtkx/css` — styling.** Not part of the descending stack: it sits at the application level, alongside the React layer, and reaches GTK *through* the generated `@gtkx/gi` bindings (so down through ffi → native → GTK, never below them). `css(...)` (Emotion + stylis) serializes styles to a class-name string that an app passes to a widget's `cssClasses` prop; a `StyleSheet` (`packages/css/src/style-sheet.ts`) registers a `Gtk.CssProvider` for the display at application priority.

### Codegen and the `.gtkx` store

`pnpm codegen` reads GIR XML (e.g. `/usr/share/gir-1.0/Gtk-4.0.gir`) for the libraries in `gtkx.config.ts` and emits two generated packages into `node_modules/.gtkx/`: `@gtkx/gi` (FFI classes, property getters/setters, `connect`/`emit` switches) and `@gtkx/jsx` (one per-namespace module — `@gtkx/jsx/gtk`, `/adw`, … — carrying that namespace's `Props` types, the `React.JSX.IntrinsicElements` augmentation, and one `createWidgetComponent` line per element (HOC-wrapped for windows, applications, dialog buttons, and actions) plus a `@gtkx/gi/<ns>` side-effect import, alongside one merged `@gtkx/jsx/metadata` holding the `SIGNALS`/`CONSTRUCT_ONLY_PROPS`/`DEFAULT_PROPS` tables plus the reconciler's data tables — codegen's built-ins merged with the project's `elementMap`/`arrayProps`/`slots`/`containerSlots` config rows). `@gtkx/jsx` relates to `@gtkx/react` as `@gtkx/gi` relates to `@gtkx/ffi`: `@gtkx/react` is the namespace-agnostic runtime (`render`, `quit`, hooks, the reconciler, and the hand-written runtime components the namespace modules wrap with typed exports), and each `@gtkx/jsx/<ns>` builds on it. The import model is uniform: app code imports every element-like component from `@gtkx/jsx/<ns>` (including the enhanced ones — `GtkListView`, `GtkColumnView`, `GtkDrawingArea`, `AdwComboRow`, …), `render`/`quit`/hooks/shared types from `@gtkx/react`, animation components (`AnimatePresence`, `AdwTimedAnimation`, `AdwSpringAnimation`) from `@gtkx/animate`, and widget enums/classes from `@gtkx/gi/<ns>`. The metadata reaches `@gtkx/react` through the `virtual:gtkx-config` module the gtkx Vite plugin serves, so importing only `@gtkx/jsx/gtk` never loads Adwaita. The pipeline entry is `packages/codegen/src/runner.ts` (`CodegenRunner`); per-namespace FFI emission is in `packages/codegen/src/ffi/pipeline.ts`, React emission in `packages/codegen/src/react/pipeline.ts`. Hand-written override templates (`packages/codegen/src/templates/<ns>/`) are raw `.ts` assets — excluded from codegen's own TS program — embedded into the store as `<ns>/overrides/*.js` plus the namespace barrel; they import only `@gtkx/ffi` (which owns the non-introspectable helpers, e.g. `@gtkx/ffi/cairo` and the listener tracking) and generated modules, never `@gtkx/native`.

## Packages

| Package | Responsibility |
| --- | --- |
| `@gtkx/native` | Rust napi-rs module: libffi call primitives, GLib thread + mailbox, toggle refs, freeze. |
| `@gtkx/ffi` | FFI runtime: GObject lifecycle, marshalling, signals, class registry. Depends on native + utils. |
| `@gtkx/codegen` | GIR-driven generator for `@gtkx/gi` and `@gtkx/jsx`; owns the built-in reconciler tables. Depends on utils + config. |
| `@gtkx/config` | `gtkx.config.ts` schema, validation, c12 loader, and the `virtual:gtkx-config` module renderer. Leaf. |
| `@gtkx/gl` | Hand-written OpenGL bindings (no GIR backing) for `GLArea` rendering. Depends on ffi only. |
| `@gtkx/react` | React 19 reconciler, `render`, hooks (`useApplication`, `useProperty`, `useSetting`), portals. |
| `@gtkx/animate` | Adwaita-powered animation components: `AnimatePresence`, `AdwTimedAnimation`, `AdwSpringAnimation`. Depends on react. |
| `@gtkx/css` | Emotion-based CSS-in-JS targeting `Gtk.CssProvider`. |
| `@gtkx/cli` | `gtkx` binary: `create`, `codegen`, `dev` (Vite + Fast Refresh), `build`. |
| `@gtkx/mcp` | MCP server exposing running apps to AI agents (widget tree, query, click, type, screenshot). |
| `@gtkx/testing` | Testing Library-inspired API: `render`, queries, `userEvent`, `waitFor`, `screen`. |
| `@gtkx/vitest` | Vitest plugin: per-worker Xvfb + D-Bus, `forks` pool, single-module-identity inlining. |
| `@gtkx/utils` | Leaf helpers (case converters, equality, shutdown). No GTKX deps. |
| `@gtkx/e2e` | Private integration + reconciler benchmark suite. |

Module boundaries are enforced by `.dependency-cruiser.cjs`: no cycles; `@gtkx/native` is importable only by `ffi`, `react`, `codegen`; `@gtkx/codegen` references native via `import type` only and never imports `@gtkx/react` (the built-in reconciler tables flow the other way, through the generated metadata); `@gtkx/mcp` may depend only on `utils`; `@gtkx/utils` and `@gtkx/config` depend on no GTKX package.

## Gotchas

- **Build ordering.** `native-build` and `pnpm codegen` must precede any TypeScript build of `ffi`, `react`, `testing`, `css`, or `cli`. Turbo handles this; a manual `tsc -b` in one package without it will fail to resolve `@gtkx/gi` or `native-binding.cjs`.
- **Xvfb is required for any test touching GTK.** `@gtkx/vitest` spawns a per-worker Xvfb and D-Bus automatically; raw `cargo test` needs `xvfb-run -a`. Cargo tests are always `--test-threads=1` (single GLib main thread).
- **The `.gtkx` store** (`node_modules/.gtkx`, with `gi` and `jsx` subdirectories) is where codegen writes the generated packages. `pnpm lint:all` creates a root-level `.gtkx` symlink pointing at it (`ln -sfn node_modules/.gtkx .gtkx`) so knip and depcruise can analyze them; that symlink is gitignored.
- **GTK 4.22.4 is the pinned target** (the CI image pins this exact bugfix release). Layout and text metrics are version-sensitive; snapshot tests assume this version (and `GSK_RENDERER=cairo`, software GL).
- **TypeScript 6.0.3 is patched** (`patches/typescript@6.0.3.patch`); upgrading requires a new patch.
- The `source` export condition resolves `@gtkx/*` to TypeScript source during build and test; tests run in the `forks` pool so each worker is a fresh process with one shared `@gtkx/ffi` identity.

## Conventions

Formatting, naming, and import rules are enforced by `biome.json`; module boundaries by `.dependency-cruiser.cjs`; unused exports and dependencies by `knip.json`. The rules that tooling does not catch are project policy, checked in review.

Enforced by Biome:

- **Formatting:** 4-space indentation, 120-character lines, double quotes, `kebab-case` filenames, shorthand array types (`T[]`), `node:` protocol for Node built-ins, `import type` / `export type` for type-only symbols.
- **Naming:** `PascalCase` types and components, `camelCase` values, `CONSTANT_CASE` constants.
- **No non-null `!` assertions and no definite-assignment assertions** (`noNonNullAssertion`). Express invariants through constructors, factories, or control flow.

Project policy (not caught by Biome):

- **Never use `as unknown as` casts**, for any reason. If one seems necessary, the type model is wrong — fix the types or the abstraction.
- **No inline comments.** Clarify through naming and structure. JSDoc and module-level blocks are the exception; all public exports require full JSDoc (`@param`, `@returns`, `@example`).
- Documentation describes what the code does now — never its history, prior state, or what it replaced. That record lives in git.
- **DRY:** after a change, detect duplication with the `jscpd` skill and resolve it with `dry-refactoring`.

Other conventions:

- **Tests** live under a package's `tests/` directory (never `src/`), named `*.test.ts(x)`. The React reconciler is exercised in `@gtkx/e2e`, which also holds the only benchmarks (`*.bench.tsx`) and the shared `tests/helpers/`. Packages whose tests render widgets call `@gtkx/testing`'s `cleanup` in a global `afterEach`.
- **Commits:** concise single-line imperative subjects ("Fix memory leak in signal cleanup"); reference issues with `Fixes #123`.

## App structure

A minimal app is three files. `gtkx.config.ts` declares the GIR libraries to generate:

```ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0"],
});
```

`src/index.tsx` constructs the application and renders:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { render } from "@gtkx/react";
import { App } from "./app.js";

const app = new Gtk.Application({ applicationId: "com.example.myapp" });
render(<App />, app);
```

`src/app.tsx` is the root component; every element-like component (`GtkApplicationWindow`, `GtkBox`, `GtkColumnView`, `GtkMenuButton`, ...) is imported from `@gtkx/jsx/<ns>` (e.g. `@gtkx/jsx/gtk`, `@gtkx/jsx/adw`), `render`/`quit` and hooks from `@gtkx/react`, animation components (`AnimatePresence`, ...) from `@gtkx/animate`, and widget enums and classes from `@gtkx/gi/<ns>`. See `examples/hello-world` for the canonical reference, and `examples/gtk-demo`, `examples/tutorial`, `examples/browser` for richer apps.
