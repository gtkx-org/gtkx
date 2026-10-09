---
title: "Testing"
description: "Run package contracts and sanitized generated-binding tests."
---

# Testing

Tests exercise public behavior through real implementations. Package integration suites own their contracts; `packages/e2e` contains React and generated native binding coverage. Use mocks only for slow operations or isolation that real behavior cannot provide. The [application testing guide](/v2/guide/testing) explains native rendering, queries, input and assertions.

## Coverage ownership

All suites use Vitest. Tests in `utils` are unit tests; the other package-local suites are integration tests. React and native bindings form the E2E suites. These exercise the GTKX stack through code, with React driven by `@gtkx/testing`.

| Package     | Essential contract                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------- |
| animated    | The public `animated` adapter, native updates, refs and cleanup through `@gtkx/testing`.        |
| cairo       | Public bindings against Cairo, including drawing, surfaces, paths, fonts, patterns and regions. |
| cli         | Every command through argument parsing and actual filesystem, build or session behavior.        |
| codegen     | Real GIR input, emitted bindings/reference and consumer typechecking.                           |
| components  | Collection, selection, factory and toast behavior through `@gtkx/testing`.                      |
| config      | Loading, validation, merging, paths and reload with actual configuration files.                 |
| create-gtkx | Scaffolding options, generated files, errors and installation boundaries.                       |
| css         | Computed GTK styling from public CSS APIs.                                                      |
| forms       | Controls, submission, validation, defaults and cleanup through `@gtkx/testing`.                 |
| gl          | Binding calls in a real GL context.                                                             |
| i18n        | Catalogs and React translation behavior through `@gtkx/testing`.                                |
| mcp         | Protocol requests, resources, tool routing and server lifecycle.                                |
| native      | Generated GNOME test bindings under ASan, with a leak check after every test.                   |
| navigation  | Navigation state, adaptive layouts and lifecycle through `@gtkx/testing`.                       |
| react       | Default element behaviors and reconciliation through `@gtkx/testing` in `packages/e2e`.         |
| runtime     | Runtime-exposed functions and process lifecycle without generated GIR library imports.          |
| storybook   | Story composition, controls, actions and sessions through `@gtkx/testing`.                      |
| testing     | Rendering, queries, input, assertions, waiting and isolation.                                   |
| utils       | GTKX-owned utility behavior through focused unit tests.                                         |
| vitest      | Real fixture runs, worker preloads, isolation and teardown.                                     |

Prefer one clear scenario for each distinct contract. Consolidate historical bug cases into that coverage instead of growing a separate regression suite. Upstream libraries own their generic algorithms; GTKX tests cover how it integrates with them. Test counts and file counts are not coverage goals.

The current React suite covers the shared child adapter used by `GtkDragIcon`, but does not retain a dedicated native drag-session case.

## Run tests

```bash
pnpm test
pnpm e2e
pnpm test:asan
```

`pnpm test` runs package-local integration and unit tests. `pnpm e2e` runs React and depends on the sanitized native suite. `pnpm test:asan` selects that same native suite directly. Native tests have no ordinary unsanitized test target.

Run a package or pass a Vitest file filter through Nx:

```bash
pnpm nx run @gtkx/components:test
pnpm nx run @gtkx/utils:test
pnpm nx run @gtkx/components:test -- tests/drop-down.test.tsx
pnpm nx run @gtkx/e2e:e2e
```

Nx prepares prerequisite builds and generated bindings and caches each suite. CI runs affected `build`, `test`, `typecheck`, `lint` and `e2e` targets in one graph. The native sanitizer task is an E2E dependency and runs once. A manual CI dispatch runs the complete graph. Required checks are `tests`, `build`, `typecheck`, `lint` and `e2e`.

The shared configuration limits workers according to available CPU parallelism. Set `GTKX_MAX_WORKERS` to reduce resource use:

```bash
GTKX_MAX_WORKERS=2 pnpm nx run @gtkx/components:test
```

## Native fixtures and sanitizers

The native E2E suite generates bindings from a pinned checkout of GNOME's `gobject-introspection-tests`. `GIMarshallingTests` supplies marshalling cases; `Regress` supplies general binding cases. Exercise the generated APIs with inputs and assertions appropriate to their upstream contracts, including ownership, callbacks, containers, fields, properties, signals and vfuncs.

A complete `pnpm test:asan` run collects V8 execution coverage of both generated namespaces. It checks every exported function, concrete constructor, class/interface method, getter and setter by its receiver and source range. The gate rejects untested APIs and obsolete exclusions. Filtered runs support diagnosis without enforcing whole-suite coverage. Signals are asserted through their generated emitters and listeners, including zero, one and multiple listeners for transferred arguments.

The checked-in `packages/e2e/tests/native/coverage-inventory.json` records the coverage summary and precise exclusions. An independent raw GIR audit requires bindings for every introspectable callable, signal, property access mode and virtual method in both namespaces. Lifecycle-only vfuncs require metadata but have no generated call proxy. The audit lists declarations explicitly disabled by the upstream scanner separately. A few scanner declarations have no C implementation: their tests assert the missing-symbol diagnostic. Other exclusions are fields on abstract records with no upstream factory and unsafe writes to private ownership bookkeeping.

After reviewing a deliberate API or suite change, refresh the summary from a complete run:

```bash
pnpm test:asan --skip-nx-cache
pnpm exec tsx packages/e2e/tests/helpers/native-fixtures-coverage.ts --write
```

The first command reports a stale inventory after the tests pass if its summary needs updating. Detailed API-to-suite execution evidence is written to `build/native-tests/coverage/inventory.json`. Coverage establishes which generated wrappers ran; assertions and sanitizers establish their behavior.

GTKX does not maintain custom C test fixtures. Historical probes without an upstream equivalent are retired. Observable runtime behavior such as keep-alive, quit, logging and parent death belongs in the runtime suite, using TypeScript child processes where process isolation is necessary.

The fixture preparation target downloads and builds the pinned upstream source and generates bindings:

```bash
pnpm nx run @gtkx/e2e:_test:fixtures
```

The first run needs network access and includes the upstream Cairo cases. Outputs live under `build/native-tests`; Nx caches compilation and generated bindings. Preserve the pinned revision when reproducing a failure.

Both the Rust addon and upstream C libraries are instrumented. Before the suite starts, an isolated TypeScript canary deliberately leaves an allocation unowned; the shared per-test hook must reject it.

ASan uses the nightly Rust toolchain pinned in `packages/native/tools/rust-toolchain.toml` and the system `libasan` runtime. The instrumented addon is separate from the ordinary build, under `packages/native/build/asan`. The launcher selects it with a preload before the test worker loads GTKX.

Native test setup requires ASan and exposed garbage collection. After each test it drains pending cleanup and collects garbage before calling LeakSanitizer. Test-specific teardown must release retained references first. Cases in one process run sequentially so allocations and cleanup are attributable to the active test. Sanitizer errors and leak reports fail the suite; an absent sanitizer must not silently pass.

Review leak suppressions narrowly. Eight upstream signal emitters leak their original argument storage even without listeners; their exact allocation stacks are suppressed and documented in `lsan.supp`. The tests still exercise every ownership variant and check for other leaks after each case. Reachable objects can still be retained incorrectly, so assertions about observable ownership or finalization remain useful where the upstream fixtures expose them.

## Native UI integration

`@gtkx/vitest` gives each test worker a private Wayland compositor, runtime directory and D-Bus session. Guards clean those resources up when the worker or runner exits. Package suites merge the shared source-resolution configuration, which resolves workspace TypeScript and inlines GTKX dependencies.

Importing `@gtkx/testing` installs matchers and rendering cleanup. `render` is asynchronous. Use `screen` and `within` to query accessible widget state, `userEvent` for interactions, and `waitFor` for asynchronous outcomes. Keep native assertions focused on externally observable state.

Application examples and the React E2E suite use `@gtkx/cli/vitest-plugin` when they need application transformations such as settings schemas, assets or custom elements. The Storybook example keeps its own consuming-application tests. The tutorial application is outside the workspace and runs its application tests from its own directory.

## Other checks

```bash
pnpm build
pnpm typecheck
pnpm lint
```

Build, typechecking and static analysis complement tests. Lint includes formatting, unused-code checks, workflow checks, the container command harness, rustfmt and Clippy. `pnpm lint` also checks current Rust advisories.

For a documentation change, build the website and inspect the resulting page. For a visible widget or application change, run the affected example and inspect its live widget tree, interactions and screenshots.

To diagnose a failure, reproduce it with the owning suite's configuration. Check prerequisites first when no test starts: native build, GIR discovery, fixture compilation, generated bindings, compositor and session bus. `screen.debug()` and `screen.logRoles()` help explain UI assertions. The live application also exposes inspection through [MCP](/v2/guide/mcp).
