# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTKX is a framework for building native GTK4 desktop applications using React and TypeScript. It bridges React's component model with GTK4's native widget system via a custom React Reconciler and Rust-based FFI bindings using libffi.

## Build Commands

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm lint                 # Lint with Biome
pnpm lint --write         # Auto-fix lint issues
pnpm knip                 # Check for unused code
```

For headless testing (CI or without display):
```bash
xvfb-run -a pnpm test
```

## Architecture

### Package Structure

- **@gtkx/react** (`packages/react`) - React reconciler and JSX components
- **@gtkx/ffi** (`packages/ffi`) - Generated TypeScript FFI bindings for GTK4
- **@gtkx/native** (`packages/native`) - Rust native module providing FFI bridge via libffi
- **@gtkx/css** (`packages/css`) - Emotion-style CSS-in-JS for GTK widgets
- **@gtkx/gir** (`packages/gir`) - GObject Introspection XML parser for code generation

### Data Flow

```
React Components (TSX)
        ↓
@gtkx/react Reconciler (reconciler.ts)
        ↓
Node Factory (factory.ts) → Specialized Nodes (widget.ts, list.ts, grid.ts, etc.)
        ↓
@gtkx/ffi Generated Bindings
        ↓
@gtkx/native Rust Bridge (lib.rs → start/stop/call/read/write/alloc)
        ↓
libffi → GTK4 C Libraries
```

### Key Abstractions

**React Reconciler** (`packages/react/src/reconciler.ts`): Implements React Reconciler HostConfig, managing widget creation/updates and signal routing.

**Node Classes** (`packages/react/src/node.ts`, `packages/react/src/nodes/`): Abstract factory pattern for GTK widgets:
- `WidgetNode` - Default for all GTK widgets
- `ListViewNode`/`ListItemNode` - ListView management
- `GridNode`/`GridChildNode` - GridView management
- `DropDownNode`/`DropDownItemNode` - DropDown menus
- `OverlayNode` - Overlay container
- `SlotNode` - Virtual container for children

**FFI Generation** (`packages/ffi/scripts/codegen.ts`): Generates TypeScript bindings from GIR XML files in `/usr/share/gir-1.0`, outputting to `src/generated/`.

**Native Module** (`packages/native/src/lib.rs`): Rust Neon module exporting `start`, `stop`, `call`, `read`, `write`, `alloc` functions for GTK application lifecycle and FFI operations.

### Widget Hierarchy Rules

Different parent widgets use different child attachment methods:
- ActionBar → `packStart()`
- Notebook → `appendPage()`
- Overlay → custom `attachChild()` API
- Default → `appendChild()`

### Signal Handling

Type-safe signal connections using `SignalMeta` metadata. Generated connect methods with typed handler wrappers and parameter marshalling via libffi.

## Code Generation

FFI bindings are generated from GIR files:
```bash
cd packages/ffi
pnpm codegen
```

This syncs GIR files from system to `girs/` directory and generates TypeScript classes in `src/generated/`.

## Running Examples

```bash
cd examples/gtk4-demo
pnpm start
```

## System Dependencies

Fedora:
```bash
sudo dnf install gtk4-devel gobject-introspection-devel gtksourceview5-devel
```

Ubuntu/Debian:
```bash
sudo apt install libgtk-4-dev gobject-introspection
```

## Conventions

- **Props**: camelCase with `onEvent` handlers
- **Constructor params**: Extracted from props via `CONSTRUCTOR_PARAMS` in generated code
- **Formatting**: Biome with 4-space indent, 120 line width

## Code Style

### Functional Programming

- Prefer functional programming over imperative/OOP
- Use pure functions and immutable data
- Only use classes when encapsulation is necessary (e.g., FFI bindings)

### Modern TypeScript

- Use latest ES2024+ features whenever possible
- Use `const` arrow functions for exports
- Prefer nullish coalescing (`??`) over logical OR (`||`)
- Use optional chaining (`?.`) where appropriate
- Avoid type casts (`as`) - use type guards instead
- Avoid `as unknown` casts - refactor to use proper types
- Avoid non-null assertions (`!`) - use proper null checks or type narrowing
- Ensure there are no TypeScript errors after any code change

### No Comments

- Code should be self-documenting
- Never add inline comments - if code needs explanation, refactor it
- Use TSDoc only for public APIs
- Prefer descriptive names over comments
- Never edit generated files in `src/generated/` directories

### Naming

- Use kebab-case for all files: `my-component.ts`
- Exception: generated files
- Names should be clear but not overly specific
- Prefer generic reusable names: `setup` over `setupTestsForGtk`
- Avoid redundant context in names: `loadFile` not `loadGirFile` in a GIR-specific module

### Code Reuse

- DRY (Don't Repeat Yourself) is top priority
- Extract shared logic into utility functions
- Prefer composition over duplication
- If code is copied more than once, extract it

### Dead Code

- Always check for and eliminate dead code after refactors
- Run `pnpm knip` to detect unused exports
- Remove unused imports, variables, and functions immediately
- Never leave commented-out code in the codebase
