# Contributing to GTKX

Thank you for your interest in contributing to GTKX! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior via GitHub issues.

## Getting Started

### Prerequisites

- **Node.js** 22 or later
- **pnpm**
- **turbo**
- **Rust** stable toolchain
- **Linux** with GTK4 development libraries

### System Dependencies

GTKX requires GTK4 and related development libraries. Install them using your distribution's package manager.
Check the [CI workflow file](.github/workflows/ci.yml) for a complete list of dependencies.

### Development Setup

1. **Fork and clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/gtkx.git
cd gtkx
```

1. **Install dependencies:**

```bash
pnpm install
```

1. **Build all packages:**

```bash
pnpm build
```

## Making Changes

### Branching Strategy

1. Create a branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

1. Use descriptive branch names:

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

- Ensure all packages build: `pnpm build`
- Ensure all tests pass: `pnpm test`
- Ensure linting passes: `pnpm lint`
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
 * @param app - The GTK application that hosts the rendered tree
 */
export function render(element: ReactNode, app: Gtk.Application): void;
```

### Examples

Examples in `examples/` serve as both documentation and integration tests. When adding features, consider updating or adding examples to demonstrate usage.

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/gtkx-org/gtkx/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/gtkx-org/gtkx/issues)
- **Security:** Report security vulnerabilities privately via GitHub's security advisory feature

---

Thank you for contributing to GTKX!
