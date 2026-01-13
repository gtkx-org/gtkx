# Contributing to GTKX

Thank you for your interest in contributing to GTKX! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
 - [Prerequisites](#prerequisites)
 - [System Dependencies](#system-dependencies)
 - [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
 - [Building](#building)
 - [Testing](#testing)
 - [Linting](#linting)
 - [Code Generation](#code-generation)
- [Making Changes](#making-changes)
 - [Branching Strategy](#branching-strategy)
 - [Commit Messages](#commit-messages)
 - [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
 - [Bug Reports](#bug-reports)
 - [Feature Requests](#feature-requests)
- [Code Style](#code-style)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior via GitHub issues.

## Getting Started

### Prerequisites

- **Node.js** 22 or later
- **pnpm** (latest recommended)
- **Rust** stable toolchain with `clippy`
- **Linux** with GTK4 development libraries

### System Dependencies

GTKX requires GTK4 and related development libraries. Install them using your distribution's package manager.

**Fedora:**

```bash
sudo dnf install \
 gtk4-devel \
 gobject-introspection-devel \
 gtksourceview5-devel \
 libadwaita-devel \
 webkitgtk6.0-devel \
 vte291-gtk4-devel \
 gstreamer1-devel \
 gstreamer1-plugins-base-devel \
 libsoup3-devel \
 json-glib-devel \
 libxml2-devel \
 libsecret-devel \
 at-spi2-core-devel \
 appstream-devel \
 mesa-libGLES \
 xorg-x11-server-Xvfb
```

**Ubuntu/Debian:**

```bash
sudo apt install \
 libgtk-4-dev \
 libgirepository1.0-dev \
 libgtksourceview-5-dev \
 libadwaita-1-dev \
 libwebkitgtk-6.0-dev \
 libvte-2.91-gtk4-dev \
 libgstreamer1.0-dev \
 libgstreamer-plugins-base1.0-dev \
 libsoup-3.0-dev \
 libjson-glib-dev \
 libxml2-dev \
 libsecret-1-dev \
 libappstream-dev \
 xvfb
```

**Arch Linux:**

```bash
sudo pacman -S \
 gtk4 \
 gobject-introspection \
 gtksourceview5 \
 libadwaita \
 webkitgtk-6.0 \
 vte4 \
 gstreamer \
 gst-plugins-base \
 libsoup3 \
 json-glib \
 libxml2 \
 libsecret \
 appstream \
 xorg-server-xvfb
```

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

4. **Verify the setup by running tests:**

 ```bash
 pnpm test
 ```

## Project Structure

GTKX is a monorepo managed with pnpm workspaces and Turborepo:

```
packages/
├── react/ # React reconciler, JSX components, render()
├── ffi/ # Generated TypeScript FFI bindings
├── native/ # Rust/Neon native module (GTK4 bridge)
├── cli/ # gtkx CLI - scaffolding, dev server with HMR
├── codegen/ # Generates FFI/JSX bindings from GIR files
├── gir/ # GObject Introspection XML parser
├── css/ # CSS-in-JS styling system
├── testing/ # Component testing utilities
├── vitest/ # Vitest plugin for Xvfb display management
└── e2e/ # End-to-end tests

examples/ # Example applications
website/ # Documentation site (Docusaurus)
girs/ # GObject Introspection XML files
```

Key entry points:

| File | Purpose |
|------|---------|
| `packages/react/src/render.tsx` | `render()` function and app lifecycle |
| `packages/react/src/host-config.ts` | React reconciler implementation |
| `packages/native/src/lib.rs` | Rust FFI exports |
| `packages/ffi/src/index.ts` | JavaScript FFI wrapper |

## Development Workflow

### Building

Build all packages:

```bash
pnpm build
```

Build a specific package:

```bash
pnpm --filter @gtkx/react build
```

The native Rust module requires a separate build step that runs automatically.

### Testing

Run all tests:

```bash
pnpm test
```

Tests require a display server. The `@gtkx/vitest` plugin automatically:

- Starts Xvfb instances for headless display
- Sets required GTK environment variables (`GDK_BACKEND`, `GSK_RENDERER`, etc.)
- Ensures proper display isolation between test workers

Run tests for a specific package:

```bash
pnpm --filter @gtkx/react test
```

### Linting

Run all linters:

```bash
pnpm lint
```

This runs:
- **Biome** for TypeScript/JavaScript formatting and linting
- **Clippy** for Rust linting (in the native package)

Fix auto-fixable issues:

```bash
pnpm biome check --write .
```

Check for dead code:

```bash
pnpm knip
```

### Code Generation

FFI bindings are generated from GObject Introspection (GIR) files:

```bash
pnpm codegen
```

Run this after:
- Updating GIR files in `girs/`
- Modifying the codegen templates
- Adding support for new GTK widgets

## Making Changes

### Branching Strategy

1. Create a branch from `main`:

 ```bash
 git checkout -b feature/your-feature-name
 ```

2. Use descriptive branch names:
 - `feature/` for new features
 - `fix/` for bug fixes
 - `docs/` for documentation changes
 - `refactor/` for code refactoring

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
 - Ensure all tests pass: `pnpm test`
 - Ensure linting passes: `pnpm lint`
 - Ensure no dead code: `pnpm knip`
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

4. **CI requirements:**
 - All CI checks must pass
 - Build, lint, tests, and dead code checks run automatically

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

## Code Style

GTKX uses [Biome](https://biomejs.dev/) for code formatting and linting.

Key style rules:

- **Indentation:** 4 spaces
- **Line width:** 120 characters
- **Quotes:** Double quotes for strings
- **Semicolons:** Required
- **TypeScript:** Strict mode enabled

The Biome configuration is in `biome.json`. Your editor should pick this up automatically with the Biome extension.

For Rust code in `packages/native`:

- Follow standard Rust conventions
- Run `cargo clippy` before committing
- All Clippy warnings are treated as errors in CI

## Documentation

### Updating Documentation

The documentation site lives in `website/` and uses Docusaurus:

```bash
pnpm docs # Build documentation
cd website && pnpm start # Local preview
```

### API Documentation

API docs are generated from TypeScript with TypeDoc. Add JSDoc comments to exported functions and types:

```typescript
/**
 * Renders a React element into a GTK application.
 * @param element - The root React element to render
 * @param appId - The GTK application ID (e.g., "com.example.app")
 */
export function render(element: React.ReactNode, appId: string): void
```

### Examples

Examples in `examples/` serve as both documentation and integration tests. When adding features, consider updating or adding examples to demonstrate usage.

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/eugeniodepalo/gtkx/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/eugeniodepalo/gtkx/issues)
- **Security:** Report security vulnerabilities privately via GitHub's security advisory feature

---

Thank you for contributing to GTKX!
