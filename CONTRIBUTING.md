# Contributing to GTKX

Thank you for your interest in contributing to GTKX! This guide will help you get started.

## Ways to Contribute

- **Report bugs** — Found something broken? [Open an issue](https://github.com/eugeniodepalo/gtkx/issues/new?template=bug_report.md)
- **Suggest features** — Have an idea? [Start a discussion](https://github.com/eugeniodepalo/gtkx/issues/new?template=feature_request.md)
- **Improve documentation** — Fix typos, clarify explanations, add examples
- **Submit code** — Fix bugs, implement features, improve performance
- **Add widget support** — Help expand GTK4 widget coverage

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust toolchain (for native module)
- GTK4 development libraries:
  - Fedora: `sudo dnf install gtk4-devel`
  - Ubuntu: `sudo apt install libgtk-4-dev`
- Linux (GTK4 is Linux-only)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/eugeniodepalo/gtkx.git
cd gtkx

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

### Project Structure

```
gtkx/
├── packages/
│   ├── cli/        # CLI with Vite-based dev server
│   ├── react/      # React reconciler and JSX components
│   ├── ffi/        # Auto-generated GTK4 TypeScript bindings
│   ├── native/     # Rust native module (libffi bridge)
│   ├── css/        # CSS-in-JS styling
│   ├── testing/    # Testing utilities
│   └── gir/        # GObject Introspection parser
├── examples/       # Example applications
└── website/        # Documentation site
```

### Useful Commands

```bash
# Build a single package
cd packages/<package> && pnpm build

# Run tests for a single package
cd packages/<package> && pnpm test

# Regenerate FFI/JSX bindings from GIR files
pnpm codegen

# Check for unused code
pnpm knip

# Run an example
cd examples/gtk4-demo && pnpm dev
```

## Making Changes

### Code Style

- We use [Biome](https://biomejs.dev/) for formatting and linting
- Run `pnpm lint` before committing
- TypeScript strict mode is enabled

### Testing

- Tests require GTK4 and X11 (CI uses Xvfb)
- Tests run serially due to GTK's single-threaded nature
- Add tests for new features and bug fixes

```bash
# Run all tests
pnpm test

# Run a specific test file
cd packages/react && pnpm test tests/specific.test.tsx
```

### Generated Code

Some files are auto-generated from GIR (GObject Introspection) files:

- `packages/ffi/src/generated/` — FFI bindings
- `packages/react/src/generated/jsx.ts` — JSX type definitions

**Never edit generated files directly.** Instead:

1. Modify the generators in `packages/ffi/src/codegen/` or `packages/react/src/codegen/`
2. Run `pnpm codegen` to regenerate

### Adding Widget Support

To add support for a new GTK widget:

1. Create a Node class in `packages/react/src/nodes/`
2. Add it to the appropriate array in `packages/react/src/factory.ts`:
   - `VIRTUAL_NODES` — For nodes without a GTK widget (e.g., list items, menu items, slots)
   - `SPECIALIZED_NODES` — For nodes with custom behavior (e.g., windows, dialogs)
   - `CONTAINER_NODES` — For nodes that manage children specially (e.g., grids, lists)
3. Implement the required methods:
   - `matches()` — Type matching
   - `initialize()` — Widget creation
   - `appendChild()` / `removeChild()` — Child management
4. Run `pnpm codegen` to regenerate JSX types
5. Add tests in `packages/react/tests/`

## Submitting Changes

### Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-fix
   ```
3. **Make your changes** with clear, focused commits
4. **Test your changes**:
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   ```
5. **Push** to your fork and open a pull request

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Write clear commit messages
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes

### Commit Messages

Use clear, descriptive commit messages:

```
Add Button disabled state support

- Add disabled prop to Button component
- Update tests
- Update documentation
```

## Getting Help

- **Questions?** Open a [discussion](https://github.com/eugeniodepalo/gtkx/discussions) or [issue](https://github.com/eugeniodepalo/gtkx/issues)
- **Found a bug?** [Report it](https://github.com/eugeniodepalo/gtkx/issues/new?template=bug_report.md)
- **Documentation** — [eugeniodepalo.github.io/gtkx](https://eugeniodepalo.github.io/gtkx)

## License

By contributing, you agree that your contributions will be licensed under the [MPL-2.0 License](LICENSE).
