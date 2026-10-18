---
title: "Tech Stack"
description: "The languages, native libraries, packages, and development tools behind GTKX 2."
---

# Tech Stack

This page maps the technologies and packages on `main`. The [architecture overview](/contributing/architecture) traces how they communicate. Dependency ranges live in [package manifests](https://github.com/gtkx-org/gtkx/tree/main/packages) and the shared [pnpm catalog](https://github.com/gtkx-org/gtkx/blob/main/pnpm-workspace.yaml). The pnpm and Cargo lockfiles record the resolved dependency versions.

## Languages and execution

| Technology                      | Role in GTKX                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript 7                    | Native compiler for workspace builds, typechecking, and CLI consumer checks. TypeScript 6 supplies compiler APIs for reference generation and other tooling. |
| Oxc transformer                 | Emits generated GI and JSX store JavaScript and declarations.                                                                                                |
| React 19                        | Supplies components, hooks, state, context, and scheduling. `react-reconciler` connects React commits to GTKX's native element tree.                         |
| Node.js 26.7 or later           | Runs application JavaScript, loads the native addon, and provides the Node APIs used by applications and tooling.                                            |
| Rust, edition 2024              | Implements the native bridge, native value conversion, object lifetime handling, callbacks, and integration with the GLib main context.                      |
| C ABI and GObject Introspection | Describe the native functions, types, properties, signals, and ownership information that code generation translates into JavaScript and TypeScript.         |

The framework workspace packages use ECMAScript modules and NodeNext module resolution. The website and generated compiler configuration use bundler resolution. The shared compiler configuration enables strict checking, exact optional properties, checked indexed access, and project references. Library builds emit JavaScript, declarations, and source maps into each package's `dist/` directory. Shared TypeScript path aliases let workspace tooling resolve package source during development, and package TypeScript configurations extend the shared base.

Workspace scripts run directly with Node's TypeScript support where possible. Scripts that load generated bindings run with `node --import ./scripts/register-workspace-loader.ts` from the repository root. This preload registers `tsx` and applies the shared aliases to imports inside generated packages under `node_modules`. Generated bindings and handwritten code then resolve to the same workspace modules. Vitest uses the same aliases.

Rust is pinned by [rust-toolchain.toml](https://github.com/gtkx-org/gtkx/blob/main/rust-toolchain.toml). The addon is built with `napi-rs` as a Node-API module. It uses `libloading` to resolve native libraries and `libffi` to invoke functions described by generated metadata. The `glib` crate provides the Rust integration with GLib. Prebuilt native npm packages target x64 and arm64 Linux with glibc.

## Native platform

| Library or subsystem        | Responsibility                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| libadwaita                  | Application windows, navigation, dialogs, preferences, adaptive layouts, and GNOME presentation patterns.           |
| GTK4 and GDK                | Widgets, layout, input, accessibility, drawing surfaces, and display integration.                                   |
| GLib, GObject, and GIO      | Main contexts, reference-counted objects, properties, signals, files, settings, D-Bus, and asynchronous operations. |
| Cairo                       | Immediate-mode 2D drawing exposed through `@gtkx/cairo`.                                                            |
| OpenGL                      | GPU drawing exposed through `@gtkx/gl` and GTK's GL areas.                                                          |
| GtkSourceView and WebKitGTK | Additional libraries selected by the repository's configuration for source editing and embedded web content.        |
| Wayland and D-Bus           | Isolated displays and session services for headless development and tests.                                          |

The baseline application requirements are GTK 4.20 and libadwaita 1.8 or later. Code generation reads the GIR files installed on the development machine, so the available bindings follow that machine's libraries and the project's configuration. GTK Demo needs GTK 4.22 or later; Adwaita Demo needs libadwaita 1.9 or later. The repository selects GtkSourceView 5 and WebKitGTK 6.0 in addition to the default libraries; contributing to the whole workspace requires their development files too.

The generated `@gtkx/gi` and `@gtkx/jsx` packages belong to each project. Their namespace exports provide native classes and functions, and JSX elements, respectively. They are generated by `gtkx codegen` and linked into the project's `node_modules`; they are not published npm packages to install separately. See [Configuration and Codegen](/v2/guide/configuration-and-codegen).

## Package map

All paths below are relative to the repository root. Package names normally match their directory under `packages/`; `packages/create-gtkx` publishes as `create-gtkx`. The map describes current package contents; [Development Principles](/contributing/principles) defines their required boundaries.

### Core and generation

| Package         | Responsibility                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@gtkx/native`  | Rust addon and JavaScript bootstrap for calls into native libraries, object lifetimes, callbacks, and main-context integration. |
| `@gtkx/runtime` | Object wrappers, value conversion, signals, and GObject class registration for generated bindings.                              |
| `@gtkx/codegen` | Parses GIR and Khronos metadata and generates bindings, JSX definitions, and reference documentation.                           |
| `@gtkx/config`  | Loads and validates project configuration and supplies element and prop mappings.                                               |
| `@gtkx/react`   | React renderer, native element tree, application roots, portals, and integration with GTKX configuration and runtime.           |
| `@gtkx/utils`   | Shared utilities used across the runtime and toolchain.                                                                         |

### Application libraries

| Package            | Responsibility and upstream foundation                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `@gtkx/components` | Collection views, dropdowns, combo rows, tab collections, and toast helpers built on the GTKX renderer.           |
| `@gtkx/navigation` | Stack, tab, drawer, and split-view navigation, using React Navigation's core and routers with Adwaita containers. |
| `@gtkx/forms`      | React Hook Form integration for native controls.                                                                  |
| `@gtkx/animated`   | React Spring integration with the native frame clock.                                                             |
| `@gtkx/css`        | CSS-in-JS using Emotion serialization and Stylis, installed into GTK's CSS system.                                |
| `@gtkx/i18n`       | i18next and react-i18next integration with GNU gettext catalogs.                                                  |
| `@gtkx/cairo`      | Typed wrappers around Cairo drawing APIs.                                                                         |
| `@gtkx/gl`         | Generated OpenGL 4.6 core bindings and shader diagnostics.                                                        |

### Development and verification

| Package           | Responsibility                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@gtkx/cli`       | `gtkx dev`, `build`, `deploy`, `codegen`, `docs`, `storybook`, `mcp`, `create`, and `cleanup`; integrates Vite with the native runtime. |
| `create-gtkx`     | Interactive and noninteractive project scaffolding and starter templates.                                                               |
| `@gtkx/storybook` | Native story explorer, controls, actions, and reusable Component Story Format fixtures.                                                 |
| `@gtkx/mcp`       | MCP server for generated references, live widget inspection, and application interaction.                                               |
| `@gtkx/testing`   | Rendering, accessible widget queries, user input, assertions, and screenshots for tests.                                                |
| `@gtkx/vitest`    | Worker preload and isolated headless display and session-bus infrastructure.                                                            |
| `@gtkx/e2e`       | Private integration suite spanning the renderer, generated bindings, runtime, native bridge, and testing APIs.                          |

## Build and development tools

pnpm manages the workspace and its shared dependency catalog. Nx discovers TypeScript, Oxlint, scoped ESLint, and Vitest targets, combines them with explicit package targets, orders their dependencies, and caches eligible results. `pnpm build` builds the workspace for development. The normal CI workflow's `Verify workspace` check runs affected `build`, `test`, `typecheck`, `lint`, and `e2e` targets, plus the current Rust advisory audit. A manual CI dispatch runs the complete workspace graph.

The CLI uses Vite for application development and bundling. Its plugin stack integrates generated bindings, native assets, styles, settings, localization, and the application runtime. SWC transforms TypeScript and JSX for Fast Refresh during development; the React Compiler runs through Babel, and React Fast Refresh updates components in a running development session.

Vitest runs the JavaScript test suites. GTKX's plugin gives workers real headless Wayland displays, while the testing package works with native widgets and accessibility information. Upstream native fixtures are built with Meson and Ninja; local C fixtures use GCC. The native sanitizer target uses AddressSanitizer and LeakSanitizer.

Oxlint runs JavaScript, typed TypeScript, React, and Vitest rules from `.oxlintrc.json`. The compiler and linter are pinned separately because Oxlint ships its own native type checker. ESLint runs Vue checks, the typed Vitest unbound-method rule, and scoped React compatibility checks in `eslint.config.ts`. The React checks cover generic controlled-property reads and an intentional layout-effect regression that the corresponding Oxlint rules currently misclassify.

Oxfmt checks handwritten source and configuration formatting. Codescythe checks unused files and exports, and Rust uses rustfmt and Clippy. Shared target defaults are declared in [nx.json](https://github.com/gtkx-org/gtkx/blob/main/nx.json), project targets and overrides in `project.json`, and package scripts in `package.json`.

## Documentation, examples, and distribution

The website uses VitePress, Vue, and Shiki. Its prose lives under `website/`, and TypeDoc with its Markdown and VitePress integrations generates the working-tree API reference from public package source entrypoints after dependency builds. [website/versions.json](https://github.com/gtkx-org/gtkx/blob/main/website/versions.json) controls version labels, URL prefixes, and whether an API reference comes from the working tree or a pinned release tag.

`examples/` contains runnable applications, the GTK demo, and native stories. Examples consume workspace packages. `tutorial/` lives outside the pnpm workspace so the tutorial can also verify installation and execution as an external consumer.

GitHub Actions runs checks, prepares releases, publishes packages, and deploys the website to GitHub Pages. Nx version plans record published-package changes. CLI and codegen tests use temporary consumers linked to workspace packages; the tutorial consumes registry packages independently. Application distribution through `gtkx deploy` supports Flatpak, Debian packages, RPM packages, and AppImage; see [Deploying](/v2/guide/deploying) for those application workflows.

Continue with [Development Setup](/contributing/development) to build the workspace, or [Testing](/contributing/testing) to understand CI coverage and reproduce failures.
