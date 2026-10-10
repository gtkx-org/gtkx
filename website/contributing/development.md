---
title: "Development Setup"
description: "Set up the GTKX repository, build packages, run examples, and work on the documentation."
---

# Development Setup

Build the workspace and run an example while making changes. CI verifies the change through its `Verify workspace` check. The [package map](/contributing/tech-stack#package-map) identifies each package's role.

## Prerequisites

Use Linux with Node.js 26.7 or later. The repository's `package.json` pins pnpm through its `packageManager` field. If your runtimes are managed by mise, run the commands below through `mise exec --`, for example `mise exec -- pnpm install`.

The CI agent image pins Node.js in `scripts/ci/Dockerfile`. Publishing and fallback workflows read `engines.node` from the root `package.json` to select a compatible version.

Workspace `tsc` commands use the native TypeScript 7 compiler through the `@typescript/native` dependency alias. The `typescript` catalog entry aliases the TypeScript 6 compatibility package so code generation, Vue tooling, and batched semantic tests retain the stable compiler API. Use `pnpm exec tsc --version` to check the native compiler and `pnpm exec tsc6 --version` for the compatibility compiler. Application templates and the tutorial declare their own TypeScript dependency.

Install Rust through rustup so `rust-toolchain.toml` selects the pinned compiler and Clippy. Native formatting and sanitizers use a separate nightly; its installation command is under [Change native code](#change-native-code).

The CI environment also supplies Go, ShellCheck, and the pinned Rust advisory checker. The workflow lint target downloads its pinned actionlint and yq versions through `go run`; the advisory audit refreshes the RustSec database on every run.

The full workspace needs more system libraries than a minimal application:

| Work                              | System dependencies                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Native addon and bindings         | A C build toolchain, `pkg-config`, GObject Introspection, GLib, GTK4, and libadwaita development files.                                  |
| Workspace library selection       | GtkSourceView 5 and WebKitGTK 6.0 development files and GIR metadata.                                                                    |
| Native integration fixtures       | Git, Meson, Ninja, and the introspection scanner.                                                                                        |
| Headless examples and tests       | A supported compositor, normally Sway, `dbus-daemon`, `setpriv`, Mesa rendering support, fonts, icons, MIME data, and GSettings schemas. |
| Localization and packaging checks | GNU gettext and the packaging tools used by the target formats, including RPM and Debian tooling and Flatpak helpers.                    |

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
```

Nx runs the required dependency targets. A package build can therefore rebuild another package or regenerate bindings first. Inspect the graph and an individual project's targets with:

```bash
pnpm nx show projects
pnpm nx show project @gtkx/react
```

Use `pnpm format` to apply Oxfmt to hand-written JavaScript, TypeScript, Vue, styles, configuration, and Markdown files. CI checks the same files as part of linting. To format only files changed from `main`, run `pnpm nx format:write --base=origin/main`; Nx detects the root `.oxfmtrc.json` configuration.

The formatter preserves import and package manifest ordering. Generated outputs, test fixtures, changelogs, and generated agent instructions are excluded. Embedded code formatting is disabled so tutorial code fences and their patches remain unchanged. Rust formatting uses the pinned nightly rustfmt described below.

CI uses Nx's affected graph to select checks. Pull requests compare against their merge base, pushes against the last successful run on `main`, and merge queues against the previous merge-group commit. Native sanitizers are a required dependency of E2E coverage. A manual CI run checks the complete workspace. Focused package targets remain available for reproducing failures; see [Testing](/contributing/testing#ci-verification-and-failure-reproduction).

The `verify` job coordinates build, test, typecheck, lint, and React and native E2E tasks through Nx Cloud. Three or four managed Nx Agents run the tasks, according to the affected workspace size. The coordinator and agents use the same Ubuntu 26.04 image built from `scripts/ci/Dockerfile`; Nx runs directly inside that environment. Vitest workers use their tool defaults. The job also checks current Rust advisories and reports its result as `Verify workspace`. Configure branch protection to require this check.

The `image` job creates the versioned GHCR image from `.nx/workflows/agents.yaml` if it does not exist, then resolves its digest for the coordinator. Published image tags are never overwritten. Bump the image version in `agents.yaml` whenever the Dockerfile, its Node or Go pins, the root package manager pin, or either Rust toolchain changes. Bump it also when refreshing distribution packages. Agent initialization restores dependency downloads and Rust build artifacts, then installs workspace dependencies.

Custom managed images require the Nx Cloud dedicated compute add-on. The first publication creates a private GHCR package: make the `gtkx-ci` package public in its package settings, then rerun CI so Nx Agents can pull it. Image publication uses the repository's GitHub token and runs only for trusted checkouts with an Nx token. No separate registry credential is required.

Fork pull requests and runs without an Nx token use the same Nx task graph directly on one Ubuntu 26.04 runner. The shared `.github/actions/setup-ci` action installs that fallback environment and restores package and Rust caches. Nx schedules independent tasks in parallel and uses remote caching when an access token is available. Runtime and native environment fingerprints are included in cache inputs so system library and toolchain changes invalidate the relevant tasks.

Typed Oxlint and scoped ESLint checks depend on built package declarations. Their cache inputs include dependent declarations and the lockfile; the shared compiler-version input also invalidates tasks when the native TypeScript compiler changes.

Nx's standard TypeScript, Oxlint, ESLint, and Vitest plugins infer package targets. Other project commands run directly and declare their dependencies and cache outputs in `project.json`.

The native sanitizer task runs as an E2E dependency. The live Rust advisory audit always refreshes advisories. When Nx Cloud is enabled, CI records the audit, requests fixes for failures, and closes the run after checks finish, including after failures. Publication, Pages deployment, and release management remain in their own GitHub Actions workflows.

## Generated bindings

The root `gtkx.config.base.ts` defines the shared configuration imported by workspace packages. It selects the workspace's additional native libraries. The root generation targets select it explicitly with `--config`; package and application configs keep the normal `gtkx.config.ts` filename. Codegen reads `GTKX_GIR_PATH` when GIR files are installed outside the normal search paths.

Regenerate the workspace's bindings and other codegen targets through Nx:

```bash
pnpm codegen
```

For only the root bindings, TypeScript declarations, and widget reference:

```bash
pnpm nx run gtkx:codegen
```

The `bindings` target runs the compiled generator with the normal root config. Its dependencies are limited to the generator, config, utilities, runtime, and native bridge; renderer metadata lives in the config package so React does not need to build first. Packages that consume generated bindings depend on this target explicitly. The public `codegen` target runs the built CLI and also refreshes `.gtkx/reference`.

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
```

The build invokes `napi build` in release mode and produces the platform-specific `.node` file and generated addon declarations. CI runs the pinned nightly rustfmt check, Clippy with warnings treated as errors, and cargo-audit against the current RustSec advisories. Changes that affect ownership, callbacks, marshalling, or teardown also belong in the native integration coverage described in [Testing](/contributing/testing#native-fixtures-and-sanitizers).

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

Add coverage in the suite that owns the behavior, then rely on CI's `Verify workspace` check. [Testing](/contributing/testing) describes coverage ownership and how to reproduce a failing target. A manual dispatch of the normal CI workflow runs the complete workspace graph.

Published-package changes use an Nx version plan created by `pnpm plan`. Documentation-only and test-only changes do not need one. The [contribution guide](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) covers submission and version plans; [Publishing Releases](/contributing/releases) is for maintainers.
