---
title: "Testing"
description: "Find the right GTKX test suite, run native integration checks, and validate packaged consumer applications."
---

# Testing

GTKX's tests exercise several boundaries: React updates becoming native widgets, generated JavaScript calling C libraries, CLI commands producing runnable applications, and published packages being installed by consumers. A failure can sit at any of these boundaries, so choosing the suite matters as much as choosing the package you changed.

This page describes the existing verification infrastructure and how to run it. [Development Principles](/contributing/principles) is the home for development standards. The [application testing guide](/v2/guide/testing) documents the rendering, query, interaction, and assertion APIs used by component and application tests.

## Where coverage lives

| Location | Observable behavior exercised |
| --- | --- |
| `packages/e2e/tests` | Rendering, widget relationships, prop updates, signals, accessibility, input, runtime integration, and the testing library itself. |
| `packages/e2e/tests/native` | Generated bindings against compiled GObject Introspection fixtures: ownership, callbacks, arrays, strings, records, errors, and object lifetimes. |
| `packages/native/tests` and `packages/runtime/tests` | Native addon and JavaScript runtime behavior. |
| `packages/cli/tests` | Project configuration, codegen, development sessions, bundling, deployment output, process lifecycles, and MCP integration. |
| Other package `tests/` directories | Package-specific behavior such as forms, navigation, animation, localization, stories, and scaffolding. |
| `examples/gtk-demo/tests` | Interactions with runnable native widget demonstrations. |
| `examples/storybook/tests` | The native story explorer and reusable stories in a consuming application. |
| `scripts/release-e2e.ts` | Installation, scaffolding, building, and testing through a local package registry. |
| `scripts/tutorial.ts` | The tutorial as an external consumer, including build, startup, typechecking, tests, localization, and packaging. |

The root `vitest.config.ts` collects package test configurations, the separate native fixture project, and the GTK demo and Storybook example. Nx also declares prerequisite builds, fixture generation, and example-specific tasks. `pnpm test` uses those Nx targets; invoking Vitest directly is useful after the prerequisites have been built.

## Run the relevant suite

From a workspace prepared with [Development Setup](/contributing/development), run a package's test target:

```bash
pnpm nx run @gtkx/components:test
pnpm nx run @gtkx/cli:test
pnpm nx run @gtkx/e2e:test
```

Choose the target that covers the change. A renderer or generated binding change often needs `@gtkx/e2e:test` even when its source package has no local test target. Nx builds required dependencies and, for the end-to-end package, compiles the native test fixtures.

For a focused iteration after those prerequisites exist, select a Vitest project and test file:

```bash
pnpm exec vitest run --project e2e packages/e2e/tests/testing/user-event.test.tsx
pnpm exec vitest run --project cli packages/cli/tests/build.test.ts
```

Project names come from each `vitest.config.ts`; they are not always the npm package name. Use `pnpm nx show projects --with-target=test` to find available Nx test targets, and inspect a project's Vitest configuration when filtering its files.

The full workspace test command is:

```bash
pnpm test
```

The shared Vitest configuration derives its worker limit from available CPU parallelism. Each headless worker carries a compositor and session bus, so `GTKX_MAX_WORKERS` can reduce resource use during local work:

```bash
GTKX_MAX_WORKERS=2 pnpm nx run @gtkx/e2e:test
```

The query performance suite is excluded from the ordinary end-to-end target and the root coverage target. Run it deliberately when changing query performance:

```bash
pnpm exec vitest run --project e2e packages/e2e/tests/testing/query-perf.test.tsx
```

## How native tests run headlessly

`@gtkx/vitest` installs a Node preload before test code loads. Each worker receives an isolated Wayland runtime directory, compositor, and D-Bus session. Tests therefore create and interact with actual Adwaita and GTK widgets. The preload and its guard processes tie cleanup to the worker and the Vitest process, including abnormal exits.

Repository package suites normally use `@gtkx/vitest` directly and merge the root `sourceResolveConfig`, which resolves workspace TypeScript source and inlines GTKX dependencies. Application examples use `@gtkx/cli/vitest-plugin`, which adds the application's Vite transformations, ensures generated bindings exist, and exposes configured settings, fonts, and icons to workers.

Importing `@gtkx/testing` installs its assertions and automatic rendering cleanup. `render` is asynchronous; `screen` and `within` query native widget trees, and `userEvent` performs asynchronous input while flushing React updates. The [application testing guide](/v2/guide/testing) explains queries by accessible role and name, waiting for asynchronous changes, window containers, and screenshots.

Every worker has a private D-Bus session. Desktop services from your logged-in session are absent; GTKX supplies a minimal notifications service. Tests that need another service can register an object on the private bus and exercise the real D-Bus client against it. The main end-to-end setup also compiles its GSettings fixtures and selects the in-memory settings backend.

## Native integration and sanitizers

The native integration suite uses a pinned checkout of GNOME's `gobject-introspection-tests`. Its setup builds the C fixtures through Meson and Ninja, then runs GTKX codegen for their GIR metadata. This exercises calls through the generated bindings, JavaScript runtime, Rust addon, and native fixture libraries together.

The fixture target prepares the libraries and bindings without running the suite:

```bash
pnpm nx run @gtkx/e2e:test-fixtures
```

The first run needs network access to fetch the pinned fixture revision. Outputs live under `build/native-tests`, and the fixture bindings are linked into the native test directory. The normal `@gtkx/e2e:test` target includes this preparation and runs both the ordinary end-to-end suite and the separate native suite.

Once the addon and fixtures are built, run just the native project:

```bash
pnpm exec vitest run --config packages/e2e/tests/native/vitest.config.ts
```

Its configuration adds the fixture shared libraries to the loader path and enables available glibc heap checks. Tests use explicit garbage collection where object lifetime behavior requires it.

For native memory and lifetime changes, an additional target builds the addon with AddressSanitizer and runs the native suite with leak detection:

```bash
pnpm nx run @gtkx/e2e:test:asan
```

This target currently builds for `x86_64-unknown-linux-gnu` and requires the pinned nightly Rust toolchain and the `libasan.so.8` runtime. The script rebuilds the ordinary addon in its `finally` block after the test process finishes. Run this separately from other builds or tests that load the addon, since it replaces the same native binary during the run.

## Consumer and packaging checks

Workspace imports can pass while a published package is missing a file, export, template, or dependency. Consumer checks build the packages, publish them into a private Verdaccio registry, and install them from there:

```bash
pnpm release-e2e
pnpm tutorial
```

Run these separately when the changed behavior reaches scaffolding, package contents, installation, or deployment. They publish to the test registry managed by the scripts. They also require network access for upstream dependencies and the relevant system packaging tools.

`pnpm release-e2e` validates a freshly scaffolded consumer application. `pnpm tutorial` validates the existing Tasks application, which is intentionally outside the pnpm workspace. Its default flow installs dependencies, builds and starts the app, typechecks, runs tests, generates deployment manifests, and verifies localized AppImage, Debian, and RPM artifacts. It generates the Flatpak manifest as part of this flow; the default tutorial check does not build a Flatpak.

The tutorial script reinstalls the tutorial's dependencies and rebuilds its generated artifacts. It also accepts an npm command for a narrower pass after the registry setup:

```bash
pnpm tutorial run test
```

## Coverage and other checks

Collect workspace JavaScript coverage with:

```bash
pnpm coverage
```

The root coverage target runs Vitest with the V8 provider and then merges coverage from CLI subprocesses. It writes its report under `coverage/`. The GTK demo has its own coverage configuration and line threshold. These reports measure the configured JavaScript and TypeScript sources; Rust memory validation is handled separately by the native tests and sanitizer target.

Tests complement compilation and static analysis:

```bash
pnpm build
pnpm typecheck
pnpm lint
```

`pnpm lint` includes ESLint, Knip, rustfmt, and Clippy targets. For a documentation change, build the website and inspect the resulting pages. For a visible widget or application change, run the affected example and inspect its live tree, interactions, and screenshots as well as its test results.

## Diagnose a failure

Start with the failed target and its test file. Reproduce it with the same Vitest configuration so the source resolution, worker preload, fixture library paths, and application transformations remain in place. When it fails before a test starts, check the prerequisite that failed: native build, GIR discovery, fixture compilation, compositor startup, or session-bus setup.

For widget failures, `screen.debug()`, `screen.logRoles()`, and screenshots show the state seen by queries. A live headless development session exposes related inspection tools through [MCP](/v2/guide/mcp).

Bindings can turn a GLib critical emitted during an active call into a JavaScript exception or promise rejection. An out-of-call critical or addon panic can fail the process instead, and a GLib error can abort it. [Error Handling](/v2/guide/error-handling) explains these boundaries; native crashes need investigation below the React assertion that happened to be running.

For leftover headless runtimes, use the CLI's scoped cleanup command from a built example:

```bash
pnpm --filter hello-world exec gtkx cleanup --dry-run
pnpm --filter hello-world exec gtkx cleanup
```

The command recognizes GTKX-owned stale runtimes and compile caches. Its dry run lists the candidates before removal.
