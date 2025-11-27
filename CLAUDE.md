# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GTKX is a framework for building GTK4 desktop applications using React and TypeScript. It bridges the GTK4 C library with React's component model through FFI (Foreign Function Interface), enabling developers to write native Linux desktop applications using familiar React patterns.

## Architecture

### Package Structure

This is a pnpm monorepo with the following packages:

- **`packages/native`**: Rust-based Neon module providing FFI bindings to call GTK C functions from Node.js. Exposes `call()`, `start()`, `stop()`, and `createRef()` functions.
- **`packages/gir`**: GIR (GObject Introspection) file parser. Parses XML `.gir` files into TypeScript interfaces and maps GIR types to TypeScript/FFI types.
- **`packages/ffi`**: Generated TypeScript FFI bindings for GTK libraries. Contains a code generator that reads GIR files and produces TypeScript classes/interfaces.
- **`packages/gtkx`**: React integration layer. Implements a custom React Reconciler that translates React components into GTK widgets. Includes JSX type generation.
- **`packages/css`**: Emotion-style CSS-in-JS for styling GTK widgets with familiar CSS syntax.
- **`website`**: Docusaurus documentation site with guides and API reference.
- **`examples/demo`**: Simple demo application
- **`examples/kitchen-sink`**: More complex example with various widgets

### Key Architectural Concepts

**Code Generation Pipeline:**
1. GIR XML files (located in `/usr/share/gir-1.0` on Linux systems) describe GTK's C API
2. `@gtkx/gir` parses these files into TypeScript data structures
3. `@gtkx/ffi` generator creates TypeScript FFI bindings (classes, methods, properties)
4. `@gtkx/gtkx` generator creates JSX type definitions for React components
5. Generated code is placed in `src/generated/` directories

**React Reconciler:**
- `packages/gtkx/src/reconciler.ts` implements React's `react-reconciler` API
- Translates React elements into GTK widget instances
- Manages widget lifecycle, property updates, and parent-child relationships
- Uses specialized Node implementations for dialogs, slots, and list items
- Tracks all instances in a Set for cleanup on application quit
- `disposeAllInstances()` ensures all signal handlers are disconnected when the app exits

**Node System:**
- `nodes/widget.ts`: Base widget node, handles standard GTK widgets (fallback handler)
- `nodes/dialog.ts`: Handles dialog widgets (FileDialog, ColorDialog, FontDialog, AlertDialog, AboutDialog)
- `nodes/slot.ts`: Handles named child slots (e.g., HeaderBar start/end slots)
- `nodes/list.ts`: Handles list widgets with StringList model
- `nodes/text.ts`: Handles text nodes (wraps string children in Label widgets)
- `nodes/grid.ts`: Handles Grid widget with row/column attachment
- `nodes/dropdown.ts`: Handles DropDown widget with StringList model
- `nodes/overlay.ts`: Handles Overlay widget with child/overlay management
- `nodes/action-bar.ts`: Handles ActionBar widget with start/center/end slots
- `nodes/notebook.ts`: Handles Notebook widget with page management
- All node types implement the `Node` interface from `node.ts`
- All nodes with signal handlers must implement `dispose()` for cleanup

**Widget Capabilities:**
- `widget-capabilities.ts` provides type guards and utilities for GTK widget features
- Type guards: `isAppendable`, `isSingleChild`, `isRemovable`, `isPresentable`, `isConnectable`, etc.
- Utilities: `appendChild`, `removeChild`, `disconnectSignalHandlers`

**Factory Pattern:**
- `factory.ts` handles node creation from React element types
- `NODE_CLASSES` array defines priority order for matching types to node handlers
- `CONSTRUCTOR_ARGS` maps widget types to custom constructor argument functions
- `DEFAULT_PROPS` provides sensible defaults for widgets like Box, Separator, Scale
- Some widgets auto-create required sub-components (e.g., ColorDialogButton auto-creates ColorDialog)

**FFI Bridge:**
- Native Rust module (`packages/native`) uses libffi to dynamically call GTK C functions
- TypeScript wrappers in `packages/ffi/src/native.ts` manage app lifecycle
- `call()` function takes library name, symbol, arguments array, and return type
- Generated code uses `call()` to invoke GTK methods
- Void-returning calls are async (dispatched via `idle_add_once`); non-void calls are synchronous
- Signal handler closures capture Neon Channels, which keep Node.js alive until properly disconnected

## Requirements

For using GTKX packages:
- Node.js 20+
- GTK4 runtime libraries
- Linux

For development from source:
- pnpm 10+
- Rust toolchain
- GTK4 development headers

## Build Commands

**Initial Setup (required once):**
```bash
pnpm install
cd packages/ffi && pnpm run codegen --sync  # Sync GIR files from system
```

**Full Build:**
```bash
pnpm build  # Runs codegen + TypeScript compilation + Rust build for all packages
```

**Build Individual Packages:**
```bash
cd packages/ffi && pnpm run codegen     # Generate FFI bindings only
cd packages/gtkx && pnpm run codegen    # Generate JSX types only
cd packages/native && pnpm run build    # Compile Rust module only
```

**Run Examples:**
```bash
cd examples/demo && pnpm build && pnpm start
cd examples/kitchen-sink && pnpm build && pnpm start
```

**Code Quality:**
```bash
pnpm knip           # Find unused exports, dependencies, types
pnpm knip:fix       # Auto-fix some issues
pnpm test           # Run tests across all packages
```

**Documentation:**
```bash
pnpm docs           # Start documentation dev server
pnpm docs:build     # Build documentation for production
```

## Important Generator Behavior

**packages/ffi/src/codegen/ffi-generator.ts:**
- Generates TypeScript classes from GIR class definitions
- Generates abstract classes from GIR interfaces
- Properties become getter/setter pairs (currently throw "not yet implemented")
- Methods use `call()` from `@gtkx/native` to invoke C functions
- Tracks `usesCall` and `usesRef` to conditionally import only what's needed
- Prefixes unused parameters with `_` to avoid TS6133 errors
- Constructor functions (pattern: `namespace_class_name_new*`) are converted to static methods

**packages/gtkx/src/codegen/jsx-generator.ts:**
- Generates JSX type definitions from GTK widget classes
- Widgets with named child slots export as objects with `.Root` property
- Dialog types get separate prop interfaces
- Property names are converted from snake_case to camelCase

## Working with Generated Code

- **Never edit `src/generated/` directories directly** - they are regenerated on each build
- To modify generated code, edit the generators in:
  - `packages/ffi/src/codegen/ffi-generator.ts` for FFI bindings
  - `packages/gtkx/src/codegen/jsx-generator.ts` for JSX types
- After modifying generators, run codegen to see changes
- Generated files use Prettier for formatting

## GIR Files

- Located in workspace root `/girs/` directory after sync
- Use `pnpm run codegen --sync` in `packages/ffi` to sync from `/usr/share/gir-1.0`
- Only "important" GIR files are processed (see `GIRS_TO_SYNC` set in `packages/ffi/scripts/codegen.ts`)
- Includes: GTK-4.0, GLib, GObject, Gio, Gdk, Pango, Cairo, etc.

## Type System Notes

- React components accept GTK property names in camelCase
- Some GTK types map to TypeScript `unknown` (complex object types)
- Event handlers follow pattern `on{EventName}` (e.g., `onClicked`, `onCloseRequest`)
- Text nodes are automatically wrapped in `<Label>` widgets via `TextNode`
- GIR enums are mapped to TypeScript enums (used in generated code)

## Turbo Build System

- Uses Turborepo for task orchestration
- `codegen` task must run before `build`
- Build outputs cached in `dist/` directories
- `native-build` compiles Rust and may take longer on first run

## Coding Guidelines

**Functional Programming:**
- Prefer functional programming over imperative/OOP
- Only use classes when encapsulation is absolutely necessary (e.g., reconciler, handlers with private state)
- Prefer pure functions, immutable data, and composition
- Use `const` arrow functions for top-level exports

**Code Cleanliness:**
- Zero tolerance for unused variables, imports, or exports
- Run `pnpm knip` regularly to detect and remove dead code
- Prefix intentionally unused parameters with `_` (e.g., `_event: unknown`)
- Use TypeScript's `noUnusedLocals` and `noUnusedParameters` checks

**Modern JavaScript/TypeScript:**
- Target latest Node.js version - use all ESNext features freely
- Use `import` statements with `.js` extensions (ESM)
- Prefer `??` nullish coalescing over `||`
- Use optional chaining (`?.`) where appropriate
- Leverage `const` destructuring and rest/spread operators
- Use `for...of` instead of traditional loops
- Avoid `as` type casts unless absolutely necessary
- Prefer discriminated unions, type guards, and runtime checks with thrown errors
- Example: `if (!obj) throw new Error("Expected obj"); obj.prop` instead of `(obj as Type).prop`
- Define types explicitly rather than inline: `type Handler = (x: number) => void` not `const fn: (x: number) => void`
- Named types improve readability and reusability

**File Naming:**
- All files must use dash-case (kebab-case): `my-component.ts`, `string-list.ts`
- Never use camelCase for filenames
- Exception: generated files may not follow this pattern

**Documentation:**
- No inline comments - code should be self-documenting
- Use TSDoc comments only for:
  - Public API functions/classes that need usage explanation
  - Complex type definitions requiring clarification
- Prefer descriptive variable/function names over explanatory comments

**Architecture:**
- Maximize code reuse through composition and utility functions
- Extract common patterns into shared utilities
- Keep functions small and focused (single responsibility)
- Avoid duplication - if logic appears twice, abstract it
- Separate concerns: parsers, generators, handlers, utilities
- **No dependency injection unless absolutely necessary** - import modules directly
- Avoid passing modules/dependencies as constructor parameters
- Exception: only use DI when testing or runtime configuration is required

**Documentation Files:**
- Never create README.md, CONTRIBUTING.md, or other markdown documentation files
- Only create/modify markdown files when explicitly requested by the user
- CLAUDE.md is the exception and should be maintained
