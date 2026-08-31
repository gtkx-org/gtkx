# Contributing to GTKX

Thank you for your interest in contributing to GTKX. This document provides guidelines and instructions for contributing.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md), based on [version 2.0 of the Contributor Covenant](https://www.contributor-covenant.org/version/2/0/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to eugeniodepalo@gmail.com.

## Getting Started

### Prerequisites

- **Node.js** 26.7 or later
- **pnpm**
- **Rust** stable, plus a nightly toolchain: `rustfmt` uses nightly-only options, and the native test suite's AddressSanitizer lane builds the addon with `-Zsanitizer=address`

  ```bash
  rustup toolchain install nightly --profile minimal --component rustfmt
  ```

- **Linux** with the development libraries listed below

### System Dependencies

Codegen reads GObject-Introspection data from the development packages installed on your machine, so `pnpm build` needs the GIR files for every library the workspace declares, not just GTK4. On Debian and Ubuntu:

```bash
sudo apt install build-essential pkg-config gobject-introspection \
    libgirepository1.0-dev libgtk-4-dev libadwaita-1-dev \
    libgtksourceview-5-dev libwebkitgtk-6.0-dev meson ninja-build
```

The native test suite additionally builds the [gobject-introspection-tests](https://github.com/GNOME/gobject-introspection-tests) libraries with Meson and drives them through the generated bindings, which is why `meson` and `ninja-build` are on the list.

GtkSourceView 5 and WebKitGTK 6 are required because the `gtk-demo` and `browser` examples declare them in their `gtkx.config.ts`. Package names differ by distribution; the [CI Docker image](.github/docker/Dockerfile) is the authoritative list, and also covers the runtime pieces the test suite needs (a Wayland compositor, D-Bus, icon themes, and fonts).

#### GStreamer and looping media

Released GStreamer versions can crash the test worker when a `GtkVideo` or `GtkMediaFile` loops. Until the upstream race is fixed, demos and tests must not enable looping on media GStreamer plays; `examples/gtk-demo/src/demos/drawing/images.tsx` intentionally plays its animated GIF once.

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

Breaking removals must ship a visible warning in an earlier minor release. Renamed symbols use `@deprecated` with their introduction version; behavior changes need a CLI warning and an opt-in migration path. A removal-only major does not add unrelated features, and its migration guide must change with every deprecation.

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
