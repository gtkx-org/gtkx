# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (turbo)
pnpm codegen          # Regenerate FFI/JSX bindings from GIR files
pnpm test             # Run tests (concurrency=1 due to GTK/X11 constraints)
pnpm lint             # Run biome check
pnpm knip             # Check for unused code
```

### Per-Package Commands

```bash
cd packages/<package>
pnpm build            # Build single package
pnpm test             # Run package tests
pnpm codegen          # Regenerate bindings (ffi, react only)
pnpm native-build     # Build Rust module (native only)
```

### Running Examples

```bash
cd examples/gtk4-demo && pnpm dev   # GTK4 widget showcase
cd examples/todo && pnpm dev        # Todo app with tests
```

## Architecture

GTKX is a monorepo (pnpm workspaces + Turbo) that enables building native GTK4 desktop applications with React.

### Package Dependency Graph

```
@gtkx/cli → @gtkx/react → @gtkx/ffi → @gtkx/native (Rust/libffi)
             ↓
          @gtkx/css (also → @gtkx/ffi)

@gtkx/testing → @gtkx/react + @gtkx/ffi + @gtkx/native
@gtkx/gir → Used for codegen in @gtkx/ffi & @gtkx/react
```

### Core Packages

- **@gtkx/native** - Rust native module (Neon/N-API) wrapping libffi for GTK4 function calls
- **@gtkx/ffi** - Auto-generated TypeScript bindings for GTK4/GDK/GLib (from GIR files in `girs/`)
- **@gtkx/react** - React 19 reconciler implementation + JSX components for GTK widgets
- **@gtkx/cli** - Vite-based dev server with HMR, project scaffolding
- **@gtkx/css** - Emotion-compatible CSS-in-JS for GTK styling
- **@gtkx/testing** - Testing Library-style utilities (render, screen, userEvent, queries)
- **@gtkx/gir** - GObject Introspection XML parser for codegen

### React Reconciler Architecture

The reconciler (`packages/react/src/reconciler.ts`) creates a Node tree that manages GTK widgets:

```
JSX → React Element → Reconciler → Node Factory → Node Tree → GTK Widgets
```

Key files:
- `factory.ts` - NODE_CLASSES map, switch-based type matching
- `node.ts` - Base Node class
- `nodes/` - Specialized nodes (WindowNode, GridNode, ListViewNode, etc.)

Virtual nodes (MenuItemNode, StackPageNode, etc.) don't create widgets but manage parent relationships.

### Codegen System

Two generators parse GIR files to produce TypeScript:

1. **FFI Generator** (`packages/ffi/src/codegen/ffi-generator.ts`) → `packages/ffi/src/generated/`
2. **JSX Generator** (`packages/react/src/codegen/jsx-generator.ts`) → `packages/react/src/generated/jsx.ts`

Never edit generated code directly. Run `pnpm codegen` after modifying generators or GIR files.

## Testing Notes

- Tests require GTK4/X11. CI uses Xvfb on Fedora 43.
- Tests run serially (`--concurrency=1`) due to GTK's single-threaded nature.
- Each GTK-dependent package uses `pool: "forks"` with `singleFork: true` in vitest config.
- `GTK_A11Y=none` is set in test configs.

Run a single test file:
```bash
cd packages/react && pnpm test tests/specific.test.tsx
```

## TypeScript Configuration

- `tsconfig.base.json` - Shared config (strict mode, ESNext, composite builds)
- Per-package: `tsconfig.json` references `tsconfig.lib.json` (library) and `tsconfig.test.json` (tests)

## Key Patterns

### Adding Widget Support

1. Create Node class in `packages/react/src/nodes/`
2. Add to `NODE_CLASSES` in `factory.ts`
3. Implement: `matches()`, `initialize()`, `appendChild()`, `removeChild()`
4. Run `pnpm codegen` to regenerate JSX types

### FFI Object Management

Objects use GLib type system walking. Wrapping uses `Object.create(ClassPrototype)` without constructors. Reference tracking via `getObjectId()` in native module.
