# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTKX is a framework for building native GTK4 desktop applications using React and TypeScript. It bridges React's component model with GTK4's native widget system via a custom React Reconciler and Rust-based FFI bindings using libffi.

## Tech Stack

- **TypeScript** - Main programming language for all packages
- **React** - UI library for building component-based interfaces
- **Rust** - Native module for FFI bridge and performance-critical code
- **GObject Introspection (GIR)** - XML metadata for generating FFI bindings
- **pnpm** - Monorepo package manager
- **Biome** - Linter and code formatter
- **Knip** - Dead code detection
- **Vitest** - Testing framework
- **Turborepo** - Monorepo build system

## Commands

```bash
# Build and run
turbo build                              # Build all packages
turbo start                              # Start example app
turbo start --filter=counter-example     # Start specific example

# Documentation
pnpm run docs                            # Start documentation site

# Testing
turbo test                               # Run all tests
turbo test --filter=@gtkx/react          # Run tests for a specific package
xvfb-run -a pnpm vitest run tests/file.test.ts  # Run a single test file (requires xvfb)

# Code generation
turbo codegen                            # Generate FFI bindings from GIR files

# Linting
pnpm lint                                # Lint with Biome
pnpm lint --write                        # Auto-fix lint issues
pnpm knip                                # Check for unused code
```

Note: Tests require `xvfb-run` because GTK needs a display. Each package's test script wraps vitest with `xvfb-run -a`.

## Architecture

### Data Flow

```
React JSX → @gtkx/react (Reconciler) → @gtkx/ffi (TS wrappers) → @gtkx/native (Rust) → libffi → GTK4
```

1. **@gtkx/gir** parses GIR XML files (GTK's machine-readable API docs)
2. **@gtkx/ffi** and **@gtkx/react** use codegen to generate TypeScript classes and JSX types from GIR
3. **@gtkx/react** reconciler converts React elements into `Node` instances that wrap GTK widgets
4. **@gtkx/ffi** classes marshal TypeScript calls to C via the Rust native module
5. **@gtkx/native** uses libffi to dynamically invoke C functions at runtime

### Package Structure

- **@gtkx/react** (`packages/react`) - React reconciler and JSX components. Entry: `render()` creates GTK app and mounts React tree. Key files: `reconciler.ts` (HostConfig), `node.ts` (widget wrappers), `factory.ts` (node routing)
- **@gtkx/ffi** (`packages/ffi`) - Generated TypeScript FFI bindings. Each GTK class becomes a TS class with methods that call native FFI
- **@gtkx/native** (`packages/native`) - Rust/Neon module exposing `start()`, `stop()`, `call()`, `read()`, `write()`, `alloc()`. Uses libffi for dynamic C invocation
- **@gtkx/css** (`packages/css`) - Emotion-style CSS-in-JS for GTK widgets
- **@gtkx/gir** (`packages/gir`) - GIR XML parser. Used at codegen time by ffi and react packages
- **@gtkx/testing** (`packages/testing`) - Testing Library-inspired utilities

### Examples

- **counter-example** (`examples/counter`) - Simple counter app demonstrating state and testing
- **gtk4-demo** (`examples/gtk4-demo`) - Comprehensive GTK4 widget showcase

## Coding Guidelines

### Monorepo Practices

- Dev-only dependencies should go in the root level `devDependencies`
- Package-specific dependencies should go in each package's `dependencies` or `devDependencies`
- Use workspace protocol (`"workspace:*"`) for inter-package dependencies
- Install packages with `pnpm add <package> -w` to add to root `devDependencies`, or `pnpm add <package>` for package-specific dependencies

### Functional Programming

- Prefer functional programming over imperative/OOP
- Only use classes when encapsulation is necessary

### Modern TypeScript

- Use latest ESNext/NodeNext features as much as possible
- Avoid `any` - for unknown types, use `unknown` instead, then narrow the type
- Avoid type casts (especially `as unknown as T`) - refactor to use proper types
- Absolutely avoid non-null assertions (`!`) - use proper null checks or type narrowing
- Use project references: each package should have a main `tsconfig.json` that references a `tsconfig.{app,lib}.json` + an optional `tsconfig.test.json`. The test config should then reference the app/lib config. `app` is for examples, `lib` for packages. And they should both extend from `tsconfig.base.json` at the root.

### Comments

- Code should be self-documenting
- Never add inline comments - if code needs explanation, refactor it
- Use TSDoc only for public APIs
- Prefer descriptive names over comments
- Never edit generated files in `src/generated/` directories - run `turbo codegen` instead

### Naming

- Use kebab-case for all files: `my-component.ts`
- Names should be clear but not overly specific, and they should be consistent across the codebase
- Prefer generic reusable names: `setup` over `setupTestsForGtk`
- Use named exports only - never use default exports. Export names should be unique within a package.

### Code Reuse

- DRY (Don't Repeat Yourself) is top priority
- If code is copied more than once, extract it
- Never create a `utils` or `helpers` file - instead, prefer domain-named modules, e.g. `auth.ts`, `formatting.ts`, etc.
- Never compromise on quality to save time - refactor properly, ensure the original goal is met

### Dead Code

- Always check for and eliminate dead code after refactors
- Run `pnpm knip` to detect unused exports
- Remove unused imports, variables, and functions immediately
- Never leave commented-out code in the codebase

### Testing

- All packages must have tests covering core functionality, in `tests/` directories at the package root
- The tests should mirror the naming inside the `src/` directory
- There should be one test file per source file, e.g. `src/button.ts` -> `tests/button.test.ts`
- For the most part, the focus should be on unit testing. Integration tests should be reserved for cases where the testable outcome is not the result of a single unit (function/method). For example, React Reconciler behavior should be tested with integration tests.
- If needed, a `tests/setup.ts` file can be created for shared test setup code (`beforeEach`, mocks, etc.) for each package.
- Other necessary functions (such as shared utilities, e.g. `render`) can be placed in a `tests/utils.ts` file.
- Tests should be thorough, exercising all possible permutations of the function/method arguments.
- Tests should assert/expect specific outcomes, not just that no errors are thrown (unless that is the specific behavior being tested).
- Only mock external dependencies when absolutely necessary. Prefer testing with real instances where possible.
