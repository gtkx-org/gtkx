---
title: "Development Setup"
description: "Set up the GTKX repository, build packages, run examples, and work on the documentation."
---

# Development Setup

Build the workspace, run an example, then use focused Nx targets while making changes. The [package map](/contributing/tech-stack#package-map) identifies each package's role.

## Prerequisites

Use Linux with Node.js 26.7 or later. The repository's `package.json` pins pnpm through its `packageManager` field. If your runtimes are managed by mise, run the commands below through `mise exec --`, for example `mise exec -- pnpm install`.

Distributed CI pins Node.js 26.8.2 in its workflow, agent setup, and workload Dockerfile. Publishing and published-consumer workflows read `engines.node` from the root `package.json` to select a compatible version.

Install Rust through rustup so `rust-toolchain.toml` selects the pinned compiler and Clippy. Native formatting and sanitizers use a separate nightly; its installation command is under [Change native code](#change-native-code).

Full linting also requires Go 1.26 or later, ShellCheck on `PATH`, and the pinned Rust advisory checker:

```bash
cargo install cargo-audit --version 0.22.2 --locked
```

Keep Cargo's binary directory on `PATH`. The workflow lint target downloads its pinned actionlint and yq versions through `go run`; the advisory audit refreshes the RustSec database on every run.

The full workspace needs more system libraries than a minimal application:

| Work | System dependencies |
| --- | --- |
| Native addon and bindings | A C build toolchain, `pkg-config`, GObject Introspection, GLib, GTK4, and libadwaita development files. |
| Workspace library selection | GtkSourceView 5 and WebKitGTK 6.0 development files and GIR metadata. |
| Native integration fixtures | Git, Meson, Ninja, and the introspection scanner. |
| Headless examples and tests | A supported compositor, normally Sway, `dbus-daemon`, `setpriv`, Mesa rendering support, fonts, icons, MIME data, and GSettings schemas. |
| Localization and packaging checks | GNU gettext and the packaging tools used by the target formats, including RPM and Debian tooling and Flatpak helpers. |

GTKX's application baseline is GTK 4.20 and libadwaita 1.8 or later. Distribution package names and available versions vary. The [CI setup action](https://github.com/gtkx-org/gtkx/blob/main/.github/actions/setup-ci/action.yml) installs the complete verification environment on Ubuntu 26.04, including packaging tools and fonts.

On Debian or Ubuntu releases providing those library versions, the development packages include:

```bash
sudo apt install build-essential pkg-config gobject-introspection \
    libgirepository1.0-dev libgtk-4-dev libadwaita-1-dev \
    libgtksourceview-5-dev libwebkitgtk-6.0-dev meson ninja-build
```

This command covers native development and fixtures, not the full headless and packaging environment listed above. Check the installed library versions before building:

```bash
pkg-config --modversion gtk4 libadwaita-1
```

## Clone and build

Clone the repository, or substitute your fork's URL:

```bash
git clone https://github.com/gtkx-org/gtkx.git
cd gtkx
pnpm install
pnpm build
```

`pnpm install` links workspace dependencies, prepares the generated binding aliases, and builds the Vitest plugin's TypeScript output through the root postinstall script. `pnpm build` runs Nx's build targets with their dependencies. This includes the native addon, generated bindings, TypeScript libraries, application bundles, and website build where those targets exist.

The first full build is substantial: native compilation, OpenGL generation, and website API references all participate. Building references for a pinned documentation version may also need network access to retrieve that release's source and dependencies.

For subsequent work, use the target for the package you are changing:

```bash
pnpm nx run @gtkx/react:build
pnpm nx run @gtkx/react:typecheck
pnpm nx run @gtkx/react:lint
```

Nx runs the required dependency targets. A package build can therefore rebuild another package or regenerate bindings first. Inspect the graph and an individual project's targets with:

```bash
pnpm nx show projects
pnpm nx show project @gtkx/react
```

CI uses Nx's affected graph to select checks. Pull requests compare against their merge base, pushes against the last successful run on `main`, and merge queues against the previous merge-group commit. CI also selects native sanitizers from their task inputs and published-consumer acceptance from relevant file changes; their results contribute to the required `tests` and `e2e` checks. A manual CI run checks the complete workspace, including both validations. Locally, the root commands above still run every matching target; use a package target for focused iteration.

Nx Cloud distributes build, test, typecheck, lint, and per-file CLI E2E tasks across two to four agents. Each agent runs at most two Nx tasks, and each Vitest task uses at most two workers. `.nx/workflows/distribution-config.yaml` controls agent counts; `.nx/workflows/agents.yaml` defines their setup. Required GitHub checks remain `tests`, `build`, `typecheck`, `lint`, and `e2e`.

The standard Nx agent image hosts Docker; actual GTKX commands execute inside the Ubuntu 26.04 image defined in `scripts/ci/Dockerfile`. This requires Nx dedicated compute with Docker enabled. Docker layer caching uses `NX_DOCKER_CACHE_REGISTRY` when the add-on is enabled. Dependency downloads and Cargo compilation outputs use separate agent caches. The coordinator builds the same workload image using GitHub's Docker cache. Initialization compares native and runtime fingerprints and fails if the two environments differ; rebuild both image caches after changing system dependencies.

Nx plugin adapters and explicit project commands call `scripts/ci/run.mjs`. With `GTKX_CI_CONTAINER` set, it runs the command inside the named container with the same workspace path, user identity, and declared task environment. Local commands run directly. New CI targets must use this wrapper and declare complete cache outputs. CI validates the resolved task graph before starting agents; reproduce that check with:

```bash
pnpm exec nx run-many -t build,test,typecheck,lint,e2e-ci,test-asan --graph=/tmp/gtkx-task-graph.json
node scripts/ci/validate-graph.mjs /tmp/gtkx-task-graph.json
```

The coordinator forwards only `GTKX_MAX_WORKERS`, `NODE_OPTIONS`, and the two environment fingerprints. Nx manages its own authentication and execution variables. Keep GitHub credentials, publication tokens, and deployment permissions in GitHub Actions. Published-consumer acceptance uses a separate Nx execution environment and disables agents because its local registry, package mutations, and nested release commands must share one machine. Publication, Pages deployment, and release management also remain in GitHub Actions.

ASAN uses a second distributed command to preserve its task-level affected selection. The live Rust advisory audit is recorded on the coordinator and always refreshes advisories. The coordinator requests explicit completion and closes the Nx run in a guarded cleanup step, including after failures. Workflows without an Nx token run the same container tasks locally.

## Generated bindings

The root `gtkx.config.ts` defines the shared configuration imported by workspace packages. It selects the workspace's additional native libraries and reads `GTKX_GIR_PATH` when GIR files are installed outside the normal search paths.

Regenerate the workspace's bindings and other codegen targets through Nx:

```bash
pnpm codegen
```

For only the root bindings, TypeScript declarations, and widget reference:

```bash
pnpm nx run gtkx:codegen
```

Nx uses a private bootstrap target to generate bindings before building the CLI. The public `codegen` target runs the built CLI and also refreshes `.gtkx/reference`.

`pnpm codegen` bypasses Nx task-result caching so explicit regeneration also refreshes the generated blocks in `AGENTS.md` and `CLAUDE.md`. These files can contain developer-owned instructions and are never restored from a shared cache. Dependency builds use cached binding and reference outputs during ordinary CI tasks.

Each application example has its own configuration and codegen target. Its build and development targets refresh project declarations and reuse the workspace bindings. Generated bindings live in the root `node_modules/.gtkx`, with package links under `node_modules/@gtkx`; generated widget reference pages live in the root `.gtkx/reference`.

Change the generator, configuration, or source metadata when correcting generated behavior, then regenerate. Editing a generated output alone will be lost on the next run. For widget work, read `.gtkx/reference/index.md` to find the available element props, signals, and methods. [Configuration and Codegen](/v2/guide/configuration-and-codegen) covers the application's view of these outputs.

## Run an example

Use an example that exercises the behavior you are changing:

```bash
pnpm nx run hello-world:dev
```

The `hello-world` example is a small application shell and counter. `gtk-demo` covers a wider set of native widgets, and `storybook-example` launches the native story explorer:

```bash
pnpm nx run gtk-demo:dev
pnpm nx run storybook-example:dev
```

Run these separately as needed. The development target builds dependencies, generates the example's bindings, and starts the CLI. Changes to application components participate in Fast Refresh. When editing framework packages, rebuild the affected package and restart the example as needed so it loads the changed output.

After the initial dependency build, the example's local CLI can also start a headless session:

```bash
pnpm --filter hello-world exec gtkx dev --headless --size 1280x720
```

Keep the process's parent session alive while inspecting the app. Use the live widget tree, interactions, and screenshots to verify visible changes. The [MCP guide](/v2/guide/mcp) explains how to connect, and the [Storybook guide](/v2/guide/storybook) covers controls and reusable stories.

## Change native code

Rust source lives in `packages/native/src`. Formatting and sanitizers use the nightly pinned in [packages/native/tools/rust-toolchain.toml](https://github.com/gtkx-org/gtkx/blob/main/packages/native/tools/rust-toolchain.toml). After `pnpm install`, install that toolchain from the repository root:

```bash
(cd packages/native/tools && rustup show)
```

Rebuild after changing native code, then start a fresh app or test process to load the new binary:

```bash
pnpm nx run @gtkx/native:build
pnpm nx run @gtkx/native:lint
pnpm test:asan
```

The build invokes `napi build` in release mode and produces the platform-specific `.node` file and generated addon declarations. Rust linting runs the pinned nightly rustfmt check, Clippy with warnings treated as errors, and cargo-audit against the current RustSec advisories. Changes that affect ownership, callbacks, marshalling, or teardown also belong in the native integration verification described in [Testing](/contributing/testing#native-integration-and-sanitizers).

## Work on the website

Run the site through Nx from the repository root:

```bash
pnpm nx run @gtkx/website:dev
```

This target generates the API references before starting VitePress. For a production build and local preview:

```bash
pnpm nx run @gtkx/website:build
pnpm nx run @gtkx/website:preview
```

The preview target depends on the build target. Prose changes usually belong in Markdown, while navigation, versioning, and theme behavior live in `website/.vitepress`. The Contributing section is shared at `/contributing/` and describes repository development. Guide, Tutorial, and API Reference pages follow the prefixes declared in `website/versions.json`; GTKX 2's application documentation currently lives under `/v2/`.

The working-tree API pages are generated from public source entrypoints after building the packages. Change the exported API documentation at its source and regenerate the reference. See [Maintaining Documentation](/contributing/documentation) for page registration, version manifests, and promotion.

## Prepare a change for review

Use [Testing](/contributing/testing) to select the checks that exercise your change. The broad workspace commands are:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm e2e
```

Published-consumer and tutorial checks run with `pnpm acceptance`. Use `pnpm test:asan` after changes to native ownership, callbacks, marshalling, or teardown, and `pnpm benchmark` after changes to query performance. These checks run separately from the ordinary test targets; [Testing](/contributing/testing) describes their dependencies and focused commands.

Published-package changes use an Nx version plan created by `pnpm plan`. Documentation-only and test-only changes do not need one. The [contribution guide](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) covers submission and version plans; [Publishing Releases](/contributing/releases) is for maintainers.
