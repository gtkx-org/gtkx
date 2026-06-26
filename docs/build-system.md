# Build system and quality tooling

How the gtkx monorepo builds, tests, lints, and ships. This doc describes the durable structure of the build pipeline — the task graph, the TypeScript project-reference model, the quality gates, the test workspace, and containerized CI — rather than setup or prerequisite steps.

The repo is a pnpm workspace of TypeScript packages plus one Rust native addon. A task runner (Turbo) orchestrates every build/test/lint/typecheck/coverage operation; the root scripts wrap it, and per-package tooling is never invoked directly when a root script exists.

## Task graph

The task runner owns a single pipeline that orders work across packages by dependency. It distinguishes three kinds of task:

- **Generic per-package tasks** (build, typecheck, test, the dev/start runners, and the native build and coverage tasks) that each carry default inputs, outputs, and ordering so a task runs only after the same task has run in upstream workspace packages.
- **Package-scoped edges** that add specific cross-package ordering beyond the generic rules.
- **Root aggregates** that run repo-wide gates (lint, the test/coverage aggregates) once for the whole workspace rather than per package.

Tasks that produce deterministic output declare those outputs and are cached; long-running or always-fresh tasks (codegen, dev/start, benches) opt out of caching. Shared compiler config and a small set of environment variables feed the cache key, so editing them invalidates the affected cached work; remote-cache credentials are passed through without affecting that key.

### Two fan-in roots

Almost every build, typecheck, and test edge funnels through two upstream tasks, in order:

```
native build        (Rust addon -> compiled binaries + native binding surface)
     |
     v
CLI codegen         (reads native introspection data -> generated binding stores)
     |
     v
every TypeScript package build / typecheck / test / coverage / bench
```

The native build compiles the Rust addon into its loadable binaries and the binding surface the runtime imports. Codegen then reads the native introspection data and emits the generated binding stores (the typed FFI and JSX bindings plus reconciler metadata) that downstream packages compile against; it always re-runs.

A clean checkout therefore cannot type-check or build any TypeScript package until the native addon is compiled and codegen has produced its output. These are hard upstreams, not optional steps.

## TypeScript project references

A shared base config holds the strict compiler options every package inherits. Role-specific bases extend it for libraries (which emit declarations), example apps, and test code. Each package's own config is a thin solution file that references its role-specific configs, and each library config references the library configs of its upstream workspace dependencies. The project-reference graph thus mirrors the workspace dependency graph, and a reference-aware `tsc` build walks it in dependency order.

Libraries type-check through their emitting build plus the repo-wide source-condition check; the example apps build through the CLI and carry the only per-package typecheck task, and the native and CLI packages add their native-build and codegen tasks.

References are derived, not hand-written: a sync script computes the correct references for each package from its declared dependencies. In check mode it fails on any drift (the lint gate uses this); otherwise it rewrites the drifting configs. Hand-editing references is reported as drift — change the dependency and re-run sync.

Publishable packages also declare a source export condition pointing at their TypeScript source, so source-resolving tooling analyzes real workspace source rather than built output.

## Quality gates

The lint aggregate chains several independent checkers, all of which must pass. It first ensures the generated binding output is present on disk, because the dead-code and architecture checkers treat that generated output as in-scope source. The checkers cover, in sequence:

- **Project-reference drift** — the sync script in check mode.
- **Lint and format** — a single tool (Biome) for both, enforcing the repo's naming, import, and complexity conventions. Overrides relax the rules for generated and override code and for tests.
- **Unused code and dependencies** — a dead-code checker (knip) covering both dev-only and production-reachable dead code, with the generated bindings registered so every emitted module counts as used.
- **Architecture boundaries** — a dependency checker (dependency-cruiser) that enforces a no-cycles rule, resolving through workspace TypeScript source.

## Test workspace and coverage

The test runner (Vitest) is configured as a workspace whose projects are the per-package test configs. Each package applies the gtkx Vitest plugin to provision per-worker headless display isolation, so GTK tests get an independent display per worker.

Coverage is centralized at the root over the workspace's package sources, excluding built output, test files, and overrides. Native Rust coverage runs through its own separate task.

## Repo scripts

A small set of repo scripts back the non-package operations: deriving and checking TypeScript references, dispatching the native sanitizer and benchmark runs under the headless software-render wrapper, the release flow, and a publish smoke test that publishes into an ephemeral local registry and scaffolds, builds, type-checks, and tests a consumer app end-to-end.

## Containerized CI

CI builds a content-addressed Docker image carrying the full toolchain (the GTK/libadwaita/introspection stack, Node, Rust stable and nightly, and the profiling/sanitizer tools) and tags it by the Dockerfile's content hash. Every job runs inside that image, installs dependencies frozen, mounts the build caches, and forwards the task-runner and benchmark environment. A Dockerfile change is exercised by the same run; fork PRs that cannot push fall back to a local image build. GTK tests and benches run headless under a Wayland compositor with software rendering — running them outside that wrapper fails to initialize a display.

## The utilities leaf

A dependency-free utilities package sits at the bottom of the dependency graph; every runtime package builds on it, and it declares no gtkx dependencies. Every export is a stateless, pure helper or a type alias surfaced through a single barrel — string casing, safe source-text and identifier generation, collection helpers, error normalization, a graceful-shutdown installer, and a structural constructor type.
