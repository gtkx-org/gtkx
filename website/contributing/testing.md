---
title: "Testing"
description: "Find the right GTKX test suite, run native integration checks, and validate packaged consumer applications."
---

# Testing

Choose the suite that exercises the changed behavior: native widget interactions, generated calls, CLI output, or installed packages. The [testing principles](/contributing/principles#test-behavior-at-the-right-level) define test scope and mock policy; the [application testing guide](/v2/guide/testing) documents rendering, queries, input, and assertions.

## Where tests live

| Location | Observable behavior exercised |
| --- | --- |
| `packages/e2e/tests` | Rendering, widget relationships, prop updates, signals, accessibility, input, runtime integration, and the testing library itself. |
| `packages/e2e/tests/native` | Generated bindings against compiled GObject Introspection fixtures: ownership, callbacks, arrays, strings, records, errors, and object lifetimes. |
| `packages/e2e/tests/cli`, `mcp`, and `create-gtkx` | CLI configuration, codegen, development sessions, bundling, deployment, process lifecycles, MCP sessions, and scaffolding. |
| `packages/e2e/tests/publish.test.ts` | Installing, scaffolding, building, and testing consumer applications through a local package registry. |
| `packages/e2e/tests/tutorial.test.ts` | The tutorial as an installed consumer, including chapter checkpoints, startup, typechecking, tests, localization, and packaging. |
| `packages/native/tests` and `packages/runtime/tests` | Native addon and JavaScript runtime behavior. |
| Other package `tests/` directories | Package behavior such as forms, navigation, animation, localization, and stories. |
| `examples/gtk-demo/tests` and `examples/storybook/tests` | Native widget demonstrations and the story explorer in consuming applications. |

Nx discovers package tests from their Vitest configurations and declares prerequisite builds and generated fixtures. Examples use package scripts so Nx can discover them before the CLI plugin is built. There is no root Vitest aggregator. `pnpm test` runs the workspace's `test` targets, while `pnpm e2e` runs the `e2e` target in `packages/e2e`. That package keeps its integration suites in `vitest.integration.config.ts` and its CLI and published-consumer suites in `vitest.config.ts`.

## Run the relevant suite

From a workspace prepared with [Development Setup](/contributing/development), run the target that covers the change:

```bash
pnpm nx run @gtkx/components:test
pnpm nx run @gtkx/e2e:test
pnpm nx run @gtkx/e2e:e2e
```

A renderer or generated binding change often needs `@gtkx/e2e:test` even when its source package has no local test target. CLI, MCP, and scaffolder checks run under `@gtkx/e2e:e2e`. Nx builds their prerequisites before invoking Vitest.

Pass Vitest filters after `--` for a focused run through the same graph:

```bash
pnpm nx run @gtkx/e2e:test -- --project=integration tests/testing/user-event.test.tsx
pnpm nx run @gtkx/e2e:e2e -- --project=cli-e2e tests/cli/build.test.ts
```

Project names come from the selected Vitest configuration; they are not always the npm package name. Use `pnpm nx show projects --with-target=test` or `--with-target=e2e` to find available Nx targets.

Run both groups across the workspace with:

```bash
pnpm test
pnpm e2e
```

The shared Vitest configuration derives its worker limit from available CPU parallelism. Each headless worker carries a compositor and session bus, so `GTKX_MAX_WORKERS` can reduce resource use during local work:

```bash
GTKX_MAX_WORKERS=2 pnpm nx run @gtkx/e2e:test
```

The `test` target runs query performance checks separately with one worker through its private `_test:performance` dependency. Focus that suite when changing query performance:

```bash
pnpm nx run @gtkx/e2e:_test:performance
```

## How native tests run headlessly

`@gtkx/vitest` installs a Node preload before test code loads. Each worker receives an isolated Wayland runtime directory, compositor, and D-Bus session. Tests therefore create and interact with actual Adwaita and GTK widgets. The preload and its guard processes tie cleanup to the worker and the Vitest process, including abnormal exits.

Repository package suites normally use `@gtkx/vitest` directly and merge the root `sourceResolveConfig`, which resolves workspace TypeScript source and inlines GTKX dependencies. Application examples use `@gtkx/cli/vitest-plugin`, which adds the application's Vite transformations, ensures generated bindings exist, and exposes configured settings, fonts, and icons to workers.

Importing `@gtkx/testing` installs its assertions and automatic rendering cleanup. `render` is asynchronous; `screen` and `within` query native widget trees, and `userEvent` performs asynchronous input while flushing React updates. The [application testing guide](/v2/guide/testing) explains queries by accessible role and name, waiting for asynchronous changes, window containers, and screenshots.

Every worker has a private D-Bus session. Desktop services from your logged-in session are absent; GTKX supplies a minimal notifications service. Tests that need another service can register an object on the private bus and exercise the real D-Bus client against it. The main integration setup also compiles its GSettings fixtures and selects the in-memory settings backend.

## Native integration and sanitizers

The native integration suite uses a pinned checkout of GNOME's `gobject-introspection-tests`. Its setup builds the C fixtures through Meson and Ninja, then runs GTKX codegen for their GIR metadata. This exercises generated bindings, the JavaScript runtime, the Rust addon, and native fixture libraries together.

The private fixture target prepares the libraries and bindings without running the suite:

```bash
pnpm nx run @gtkx/e2e:_test:fixtures
```

The first run needs network access to fetch the pinned fixture revision. Outputs live under `build/native-tests`, and the fixture bindings are linked into `packages/e2e/tests/native`. The ordinary `@gtkx/e2e:test` target includes this preparation and runs both widget integration and generated binding suites. Select the latter with:

```bash
pnpm nx run @gtkx/e2e:test -- --project=e2e-native
```

Its configuration adds the fixture shared libraries to the loader path and enables available glibc heap checks. Tests use explicit garbage collection where object lifetime behavior requires it.

The native package's shared `test` target also runs AddressSanitizer through its private `_test:asan` dependency:

```bash
pnpm nx run @gtkx/native:test
```

The sanitizer run tests both the addon and generated binding fixtures with leak detection. It requires the nightly Rust toolchain pinned in `packages/native/tools/rust-toolchain.toml` and the `libasan.so.8` runtime. It selects the host's x64 or arm64 Linux target and writes a separate instrumented addon under `packages/native/build/asan`, using `packages/native/target/asan` for compilation. A Node preload redirects GTKX's addon imports to the instrumented binary in sanitizer processes. Other native addons keep their usual resolution, and the ordinary GTKX binary remains available to other targets.

## Consumer and packaging checks

Workspace imports can pass while a published package is missing a file, export, template, or dependency. The published-consumer Vitest project installs packages from a private Verdaccio registry. Nx builds the package set before the tests; Vitest's global setup publishes it once for both suites and closes the registry afterward.

Both suites are part of `pnpm e2e`. Select one through Nx when working on package contents or deployment:

```bash
pnpm nx run @gtkx/e2e:e2e -- tests/publish.test.ts
pnpm nx run @gtkx/e2e:e2e -- tests/tutorial.test.ts
```

The registry starts through `gtkx:local-registry`. Its configuration in `.verdaccio/config.yml` keeps `@gtkx/*` and `create-gtkx` local while forwarding other packages to npm. Test runs use temporary storage and isolated npm configuration. They need network access for upstream dependencies and the relevant system packaging tools.

`publish.test.ts` validates freshly scaffolded consumer applications. `tutorial.test.ts` installs a temporary copy of the Tasks application, which is intentionally outside the pnpm workspace. It typechecks, lints, builds and starts the app, runs tests, generates deployment manifests, and verifies localized AppImage, Debian, and RPM artifacts. It generates the Flatpak manifest but does not build a Flatpak. It also reconstructs and checks every v2 tutorial chapter against the installed dependencies. Temporary applications are removed after the suite.

For manual consumer testing, build and publish the workspace packages and leave the registry running:

```bash
pnpm local-registry
```

This alias runs the `gtkx:_registry:publish` target. It prints the registry URL and configuration for a separate consumer terminal. To start an empty registry without building or publishing packages, use:

```bash
pnpm nx run gtkx:local-registry
```

The registry listens on `127.0.0.1:4873` by default and clears its storage on startup. Run registry commands separately, and stop a manual registry before starting a consumer check. For interactive tutorial checkpoints, follow the [checkpoint instructions](https://github.com/gtkx-org/gtkx/tree/main/tutorial/checkpoints).

## Other checks

Tests complement compilation and static analysis:

```bash
pnpm build
pnpm typecheck
pnpm lint
```

These root commands are aliases for `nx run-many -t <target>`. `pnpm lint` includes ESLint, Codescythe, actionlint, ShellCheck, rustfmt, Clippy, and cargo-audit through the graph. CI exposes four checks: tests, build, lint, and e2e; the build check also runs typechecking.

Run `pnpm nx run gtkx:_lint:workflows` to check workflows, tracked shell scripts, and composite action steps. The target feeds composite steps to actionlint as a temporary workflow, so composite diagnostics refer to the transformed YAML. See [Development Setup](/contributing/development#prerequisites) for the Go, ShellCheck, and cargo-audit prerequisites. `pnpm nx run @gtkx/native:_lint:audit` checks current RustSec advisories without caching the result.

Run `pnpm nx run gtkx:_lint:codescythe` to focus on unused source files and exports in packages, examples, and scripts. `codescythe.json` lists public library entrypoints, executable roots, and tests. Private package barrels and `internal` barrels remain subject to usage checks. Test imports count as usage; website Vue files, declaration files, and built launchers are outside this source check.

The target generates bindings first, then `scripts/codescythe.ts` copies their JavaScript and declarations into a temporary analysis directory. This lets Codescythe count real imports from generated GI and JSX modules even though it skips `node_modules`. The copy is removed after the check. Use explicit named re-exports in private barrels: Codescythe 0.11.1 does not reliably follow named imports through `export *` there.

For a documentation change, build the website and inspect the resulting pages. For a visible widget or application change, run the affected example and inspect its live tree, interactions, and screenshots as well as its test results.

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
