# Build system and quality tooling

How the gtkx monorepo builds and ships: the Turbo task graph, the TypeScript project-references model, the lint/knip/dependency-cruiser quality gates, the `scripts/` utilities, the Vitest workspace, containerized CI, and the `@gtkx/utils` leaf package. This doc describes the durable structure behind the build commands rather than setup or prerequisite steps.

The repo is a pnpm workspace of TypeScript packages plus one Rust native addon (`@gtkx/native`). The workspace globs (`.`, `packages/*`, `packages/native/npm/*`, `examples/*`) are declared in `pnpm-workspace.yaml`, which also pins a small set of dependency `overrides`.

## Turbo task graph

`turbo.json` declares the task pipeline. Tasks fall into three shapes:

- **Generic tasks** (`build`, `typecheck`, `test`, `dev`, `start`, `bench`, `native-build`, `native-coverage`) carry default `dependsOn`/`inputs`/`outputs`. The `^task` prefix orders a task after the same task in upstream workspace packages.
- **Package-scoped overrides** (`@gtkx/ffi#build`, `@gtkx/cli#codegen`, `@gtkx/native#typecheck`, …) add specific cross-package edges.
- **Root aggregates** use the `//#name` syntax: `//#lint:all`, `//#test:all`, `//#coverage:all`.

### Two fan-in roots

Almost every build/typecheck/test edge funnels through two upstream tasks:

```
native-build  (Rust napi addon -> .node binaries + native-binding cjs/d.cts)
     |
     v
@gtkx/cli#codegen  (CLI codegen -> .gtkx GIR/JSX stores)
     |
     v
@gtkx/ffi#build, @gtkx/react#build, @gtkx/testing#build,
@gtkx/css#build, @gtkx/cli#build, @gtkx/e2e#build, typecheck, coverage, bench
```

- `native-build` compiles the Rust addon. Its `inputs` are Cargo/Rust sources; its `outputs` are the `*.node` binaries, the generated `native-binding.cjs`/`native-binding.d.cts`, and the per-arch `npm/linux-*-gnu/*.node` binaries. `RUSTUP_TOOLCHAIN`, `CARGO_INCREMENTAL`, and `CARGO_NET_RETRY` are passed through so they participate in cache correctness.
- `@gtkx/cli#codegen` runs the CLI's codegen command and `dependsOn @gtkx/native#native-build`. It is `cache: false`, so it always re-runs. The CLI codegen reads the native GIR introspection data and emits the generated `.gtkx` GIR and JSX stores that downstream packages compile against.

A consequence: a clean checkout cannot type-check or build any TypeScript package until the Rust addon is compiled and codegen has produced the `.gtkx` output. These are hard upstreams, not optional steps.

### Caching

`build`, `typecheck`, `test`, `native-build`, and `native-coverage` declare `outputs` and are cached. `@gtkx/cli#codegen`, `dev`, `start`, `bench`, and `native-bench` are `cache: false` and always re-run. `dev` and `start` are also `persistent`.

`globalDependencies` lists the shared tsconfig files so editing any of them invalidates every cached task. `globalEnv` (`NODE_VERSION`, `GTK4_VERSION`, `VERSION`) feeds the cache key; `globalPassThroughEnv` (`TURBO_TOKEN`, `TURBO_TEAM`) forwards remote-cache credentials without affecting the key.

### Root command surface

Root `package.json` scripts wrap Turbo, almost always with `--filter=!gtkx` to exclude the root meta-package from per-package fan-out. For example `build` is `turbo build --filter=!gtkx`, `typecheck` is `turbo typecheck --filter=!gtkx`. `test` runs `turbo run test:all test --filter=!gtkx`, mixing the root Vitest aggregate with per-package `test` scripts. The aggregate `test:all`/`coverage:all` themselves shell into `vitest run`.

## TypeScript project references

`tsconfig.base.json` holds the shared strict compiler options: `composite`, `incremental`, `isolatedModules`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, NodeNext module/resolution, and `react-jsx`. Three role-specific bases extend it:

| Config | Role | `outDir` | Notable |
| --- | --- | --- | --- |
| `tsconfig.lib.json` | Libraries | `dist` | `isolatedDeclarations: true`; emits declarations |
| `tsconfig.app.json` | Example apps | `out-tsc/app` | type-check/emit for examples |
| `tsconfig.test.json` | Tests | `out-tsc/test` | `emitDeclarationOnly`; includes `tests/**` + `vitest.config.ts` |

Each package's own `tsconfig.json` is a **solution file**: `files: []` plus `references` pointing at that package's `tsconfig.lib.json`/`tsconfig.app.json` and `tsconfig.test.json`. The `tsconfig.lib.json` in turn references the `tsconfig.lib.json` of each upstream workspace package. So the project-reference graph mirrors the workspace dependency graph, and builds run via `tsc -b`, which walks the references in dependency order.

The per-package script contract Turbo invokes is uniform: `build` is `tsc -b`, `typecheck` is `tsc -b --emitDeclarationOnly`. Example apps build through the CLI (`gtkx build`) instead. The relevant packages add `native-build` (`@gtkx/native`) and `codegen` (`@gtkx/cli`).

The root `tsconfig.json` carries `references: []` and only `include`s `scripts`, `vitest.config.ts`, and `gtkx.config.ts`, so it covers root-level tooling code rather than the package graph.

### Source condition

Each publishable package's `exports` declares a `source` condition pointing at TypeScript source (e.g. `"source": "./src/index.ts"`) alongside `types` and `default` pointing at built `dist`. dependency-cruiser and other source-resolving tooling follow `source` and analyze actual workspace source rather than built output.

## sync-ts-references

The references above are derived, not hand-written. `scripts/sync-ts-references.ts` discovers every package under `packages/` and `examples/`, then computes the correct references for each managed config from `package.json` dependency fields:

- **Primary configs** (`tsconfig.lib.json`/`tsconfig.app.json`) get references from `dependencies` + `peerDependencies`.
- **Test configs** (`tsconfig.test.json`) additionally include `devDependencies` and a self-reference to the package's own primary config.

Only workspace dependencies that themselves have a primary config become references; paths are emitted as POSIX-relative and sorted.

Run with `--check`, it compares the existing `references` against the desired set and exits non-zero on any drift (this is what the lint gate uses). Run without `--check`, it rewrites the drifting configs and then biome-formats the changed files. Editing references by hand is reported as drift — change the `package.json` dependency and re-run sync.

## Quality gates

`lint:all` chains four independent checkers; all must pass. It begins by creating the `.gtkx` symlink (`ln -sfn node_modules/.gtkx .gtkx`) because knip and dependency-cruiser both treat the generated `.gtkx` output as in-scope source, so it must exist when they run.

The gate runs these steps in sequence (conceptually, with knip's repo-specific flags shown):

```
ln -sfn node_modules/.gtkx .gtkx                  (ensure generated output is present)
sync-ts-references --check                         (project-reference drift)
biome check .                                      (lint + format)
knip --no-gitignore --exclude files                (unused exports/deps)
knip --production --no-gitignore --exclude files   (production-reachable dead code)
depcruise packages                                 (architecture boundaries)
```

### Biome

Single tool for linting and formatting. The formatter uses 4-space indentation and a 120-column width. The linter enforces: kebab-case filenames (`useFilenamingConvention`); a per-declaration-kind `useNamingConvention` (type parameters, enum members, object/type properties, type aliases); `noNonNullAssertion`; `useImportType`/`useExportType` consistency; `useNodejsImportProtocol`; shorthand array types; and the complexity trio `noExcessiveCognitiveComplexity`, `noExcessiveLinesPerFunction`, `useMaxParams`. Overrides relax rules for generated GL code and codegen templates (`useMaxParams` off), for tests and website screenshots (`noExcessiveLinesPerFunction` off), and disable Biome entirely for example CSS and VitePress Vue files. Its `vcs` setting reads the git ignore file.

### Knip

Detects unused files, exports, and dependencies with per-package `entry`/`project` globs in `knip.json`. It runs twice in lint — default and `--production` — to catch both dev-only and production-reachable dead code. The generated `.gtkx/gi` and `.gtkx/jsx` outputs are registered as their own workspaces whose every emitted module is an entry point, so generated code counts as used. The per-arch `packages/native/npm/*` workspaces are ignored, as is a set of system binaries (`pkg-config`, `glib-compile-resources`, `glib-compile-schemas`, `wlheadless-run`, …) that are invoked but not npm dependencies.

### dependency-cruiser

`.dependency-cruiser.cjs` enforces exactly one rule: `no-circular` (any direct or transitive cycle) as an error. It resolves through `tsconfig.base.json` with `tsPreCompilationDeps: true`, and its `enhancedResolveOptions` put `source` first in both `conditionNames` and `mainFields` so it follows workspace TypeScript source rather than built output. It excludes `dist`/`out-tsc`/`coverage`, the native `target`/`npm` directories, and all of `node_modules` except the generated `.gtkx`.

## Vitest workspace and coverage

The root `vitest.config.ts` defines a `projects` array (`packages/*/vitest.config.ts` plus `examples/gtk-demo/vitest.config.ts`) and centralizes coverage. Each package supplies its own `vitest.config.ts`, which applies the `@gtkx/vitest` plugin to provision per-worker headless display isolation so GTK tests get an independent display per worker. `bail: 1` stops the run on the first failure.

Coverage uses the v8 provider with `lcov` + `text-summary` reporters into `coverage/`, with an explicit per-package `include` list (each package's `src`, plus `packages/native/{index,types}.ts`) and exclusions for `dist`/`out-tsc`, test files, and codegen templates. Native Rust coverage runs through the separate `native-coverage` Turbo task.

## scripts/ utilities

| Script | Role |
| --- | --- |
| `sync-ts-references.ts` | Derive/check TS project references from `package.json` deps (see above). |
| `ci.ts` | Dispatch `asan` / `miri` / `bench` against `@gtkx/native`. The sanitizer and TS-bench tasks run under `wlheadless-run -c weston` with software-render env (`GDK_BACKEND=wayland`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, `GDK_DISABLE=vulkan`); `bench` wraps the Rust `cargo codspeed` bench and the `@gtkx/e2e` TS bench in a single `codspeed run`. asan uses the nightly toolchain with `-Zsanitizer=address`; miri runs the marshalling subset. |
| `publish.ts` | Release flow: `pnpm build`, copy `README.md` into every non-private package, build the native `npm` dirs and artifacts (`create-npm-dirs`, `artifacts`), then recursive `pnpm -r publish`. |
| `publish-test.ts` | Spin up an ephemeral Verdaccio registry, run the full release into it, scaffold a consumer app via `@gtkx/cli create`, then build, type-check, and test that app end-to-end (asserting the bundle and native `.node` outputs exist and are non-empty). Snapshots and restores the native manifests it mutates. |

## Containerized CI

CI builds a content-addressed Docker image carrying the full toolchain (GTK4/libadwaita/GObject-introspection/GStreamer stack, Node, Rust stable + nightly, CodSpeed/Valgrind) and tags it by Dockerfile content hash. Every job (lint, test, typecheck, publish-test, asan, miri, bench) runs inside that image via composite actions, which pnpm-install frozen, mount the cargo/pnpm caches, and forward the Turbo and CodSpeed env. A Dockerfile change is exercised by the same run's jobs; fork PRs that cannot push fall back to a local image build. GTK tests and benches run headless under a Wayland compositor with software rendering — running native test/coverage/asan outside that wrapper fails to initialize a display.

## @gtkx/utils

`@gtkx/utils` is the dependency-free leaf every runtime package sits on. It declares no gtkx dependencies and is marked `sideEffects: false`. Every export is a stateless, pure helper or a type alias, re-exported through a single barrel (`src/index.ts`); consumers import from the package root. The source modules:

- **string** — `toUpperFirst`/`toLowerFirst`, `toCamelCase`/`toPascalCase` (split on `-`/`_` and recombine), `toKebabCase` (hyphenate before interior capitals). Translates GIR/native naming into JS/TS conventions.
- **source** — safe TypeScript source-text generation. `quote()` JSON-stringifies and additionally escapes `<`, `>`, U+2028, and U+2029 so an emitted literal cannot break out of its enclosing script/string context (a security boundary, not plain `JSON.stringify`). `toIdentifier()` suffixes reserved words with `_`; `toCamelIdentifier()` composes camel-casing with reserved-word escaping. The CLI codegen writers rely on these. This is the only intra-package dependency: `source` imports `toCamelCase` from `string`.
- **collection** — `omit`, `dedupeBy` (order-preserving identity dedupe), `compareAlpha`/`sortedAlpha`/`sortedAlphaBy` (locale-aware), and `reverseNumericEnum` (numeric-value→name `Map`, dropping string-valued reverse-mapping entries, used to resolve native enum values back to names).
- **error** — `errorMessage()` coerces any thrown value to a string; `formatChildProcessError()` extracts and trims `stderr`/`stdout` (string, `Uint8Array`, or `Buffer`) from a child-process error, returning `undefined` when there is nothing to report.
- **graceful-shutdown** — `installGracefulShutdown()` registers `SIGINT`/`SIGTERM`/`SIGHUP` listeners, runs a user `onSignal` (sync or async) through a resolved promise chain, supports an unref'd force-kill timer and a second-SIGINT force escape hatch, exits with canonical codes (130 for SIGINT, 143 otherwise) overridable via an `exitCode` callback, and returns a handle whose `uninstall()` removes the listeners. `exitCodeForSignal()` is the standalone mapping. It calls `process.exit` directly, so it is for process entry points, not library contexts.
- **class** — the type-only `AnyClass<T>`, a structural alias for any (possibly abstract) constructor with a prototype, used by the FFI registry/descriptor layer as the wrapper-class generic bound.

Tests live under a parallel `tests` directory (one spec per module) run as the Vitest project `utils`. The package emits ESM only and ships both compiled `dist` and raw `src`.
