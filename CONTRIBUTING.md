# Contributing to GTKX

Thank you for your interest in contributing to GTKX. This document provides guidelines and instructions for contributing.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md), based on [version 2.0 of the Contributor Covenant](https://www.contributor-covenant.org/version/2/0/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to eugeniodepalo@gmail.com.

## Getting Started

### Prerequisites

- **Node.js** 24 or later
- **pnpm**
- **Rust** stable, plus a nightly toolchain: `pnpm test` runs the native crate's address-sanitizer and Miri suites, which need `cargo +nightly`

  ```bash
  rustup toolchain install nightly --profile minimal \
      --component llvm-tools-preview --component rust-src --component miri
  ```

- **Linux** with the development libraries listed below

### System Dependencies

Codegen reads GObject-Introspection data from the development packages installed on your machine, so `pnpm build` needs the GIR files for every library the workspace declares, not just GTK4. On Debian and Ubuntu:

```bash
sudo apt install build-essential pkg-config gobject-introspection \
    libgirepository1.0-dev libgtk-4-dev libadwaita-1-dev \
    libgtksourceview-5-dev libwebkitgtk-6.0-dev
```

GtkSourceView 5 and WebKitGTK 6 are required because the `gtk-demo` and `browser` examples declare them in their `gtkx.config.ts`. Package names differ by distribution; the [CI Docker image](.github/docker/Dockerfile) is the authoritative list, and also covers the runtime pieces the test suite needs (a Wayland compositor, D-Bus, icon themes, and fonts).

#### GStreamer and looping media

GTK 4.20 and later compile the GStreamer media backend into `libgtk-4.so`, so any widget that plays media (`GtkVideo`, `GtkMediaFile`) pulls GStreamer into the test process. A looping stream is unsafe there: with looping enabled, `GstPlay` re-sets the same URI on `about-to-finish`, `uridecodebin3` starts a second play item in gapless mode, and `switch_and_activate_input_locked` (`gsturidecodebin3.c`) unlinks and relinks `decodebin3`'s request sink pad on a `gst_task` streaming thread while `urisourcebin`'s `free_output_slot` may be destroying that same pad. The pad can already be finalized when the relink runs, which surfaces as `g_object_ref: assertion 'G_IS_OBJECT (object)' failed` or `gst_pad_link_full: assertion 'GST_IS_PAD (sinkpad)' failed`, followed by a SIGSEGV on a non-main thread that kills the whole vitest worker.

This is an upstream defect in gst-plugins-base and no released version fixes it: the only commits to `gsturidecodebin3.c` after 1.28.3 are `6a0695d9` and `8b83631e`, both of which land on `main` and the 1.29.2 development tag only, are absent from 1.28.4 and 1.28.5, and address unrelated bugs. There is therefore no minimum version to require, and no GTKX-side change can prevent it. Demos and tests avoid the gapless input switch instead, by not enabling looping on a media stream that GStreamer actually plays. `examples/gtk-demo/src/demos/drawing/images.tsx` plays its animated GIF once for that reason; upstream `gtk4-demo` loops the same GIF through a paintable that decodes the frames itself rather than a `GtkMediaFile`, so no GStreamer pipeline is involved there.

Note that `GtkVideo`'s `loop` property only applies to streams loaded *after* it is set, and GObject assigns construct properties in the order the class registered them, which puts `file` before `loop`. A `<GtkVideo loop file={...} />` therefore reports `loop` as `true` while its media stream does not loop, and does not reach the code above. Making that property effective would make the upstream crash reachable again.

### Development Setup

1. **Fork and clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/gtkx.git
cd gtkx
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Build all packages:**

```bash
pnpm build
```

## Making Changes

### Branching Strategy

1. Create a branch from `main`:

```bash
git checkout -b feat/your-feature-name
```

2. Use descriptive branch names:

- `feat/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code refactoring
- `ci/` for build and CI changes

### Commit Messages

Write clear, concise commit messages:

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Reference issues when applicable (`Fixes #123`)

Examples:

```
Add support for GtkListView widget

Implement the GtkListView component with selection support.
Includes factory pattern for item rendering.

Fixes #42
```

```
Fix memory leak in signal handler cleanup
```

### Pull Request Process

1. **Before submitting:**

- Ensure all packages build: `pnpm build`
- Ensure all tests pass: `pnpm test`
- Ensure linting passes: `pnpm lint`
- Ensure type checking passes: `pnpm typecheck`
- Update documentation if needed

2. **Create the pull request:**

- Fill out the PR template
- Provide a clear description of changes
- Link related issues
- Include screenshots for UI changes

3. **Review process:**

- Address review feedback
- Keep the PR focused on a single concern
- Rebase on `main` if needed to resolve conflicts

## Release Policy

GTKX follows the same contract for every major: **2.0 removes only what 1.x already warned about, and ships nothing new.**

### The ladder

1. **1.6** is the migration target. It ships the deprecation warnings and changes no defaults, so its behavior is identical to 1.5. A project that upgrades to 1.6, clears every warning the CLI prints, and clears every symbol tagged `Removed in v2` has already done the whole 2.0 migration.
2. **2.0** is the last 1.x minus the deprecated paths. It deletes the deprecated symbols, the `future` block, and the compatibility branches behind it. Nothing else.
3. **2.1** is where held-back feature work resumes.

### What this means for a change

- **Nothing is removed at a major that a minor did not warn about.** The warning is the permission slip. If a removal has no warning shipped in a 1.x release, it waits for the next major.
- **2.0 accepts no new features.** While 2.0 is the open milestone, a feature PR is held for 2.1 rather than merged. This applies to new bindings, new configuration keys, and new package exports, not to bug fixes.
- **A deprecation needs a warning users actually see.** A `@deprecated` JSDoc tag is enough for a renamed or replaced symbol, because editors surface it on hover. A behavior change to a symbol that keeps its name is not visible that way and needs a CLI deprecation warning with a stable id, added alongside a `future` flag. See `packages/config/src/deprecations.ts`.
- **Every deprecation carries its version.** Write `Since <version>.` in the tag, so an inventory of what a major removes can be built by reading the source.

[Upgrading to 2.0](https://gtkx.dev/guide/upgrading-to-2) is the user-facing side of this policy and must be updated in the same PR as any new deprecation.

## Issue Guidelines

### Bug Reports

When reporting bugs, include:

- GTKX version (`npm list @gtkx/react`)
- Node.js version (`node --version`)
- Operating system and version
- GTK4 version (`pkg-config --modversion gtk4`)
- Steps to reproduce
- Expected vs actual behavior
- Error messages or stack traces
- Minimal reproduction code if possible

### Feature Requests

For feature requests, describe:

- The problem you're trying to solve
- Your proposed solution
- Alternative solutions you've considered
- Whether you'd be willing to implement it

Features are still welcome while 2.0 is the open milestone, but see [Release Policy](#release-policy): they are scheduled for 2.1 rather than merged into the major.

Search existing issues before creating new ones to avoid duplicates.

## Documentation

### Updating Documentation

The documentation site lives in `website/` and uses VitePress. Run it from the repository root through Nx, not from inside `website/`. The API reference is generated by TypeDoc from each package's built `dist/`, so the build task depends on the packages being built first. The dev task does not build them, so run `pnpm build` before your first preview.

```bash
pnpm nx run @gtkx/website:build # Build documentation
pnpm nx run @gtkx/website:dev   # Local preview
```

### Examples

Examples in `examples/` serve as both documentation and integration tests. When adding features, consider updating or adding examples to demonstrate usage.

`examples/tutorial` is the exception: it is deliberately excluded from the pnpm workspace and installs GTKX from the registry, the way a project outside this repository does. Validate it against your working copy with `pnpm tutorial` from the root rather than building it directly.

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/gtkx-org/gtkx/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/gtkx-org/gtkx/issues)
- **Security:** Email eugeniodepalo@gmail.com directly; do not open a public issue (see SECURITY.md)

---

Thank you for contributing to GTKX.
