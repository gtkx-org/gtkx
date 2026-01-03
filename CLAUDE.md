# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                  # Install dependencies
pnpm turbo build              # Build all packages (native + TypeScript)
pnpm test                     # Run all tests (requires Xvfb for display isolation)
pnpm turbo lint:all           # Run Biome (TS/JS) and Clippy (Rust)
pnpm turbo knip:all           # Check for dead/unused code
pnpm turbo codegen:all        # Regenerate FFI bindings from GIR files

# Package-specific
pnpm turbo build --filter=@gtkx/react
pnpm turbo test --filter=@gtkx/react  # Use turbo directly for single packages

# Linting
pnpm biome check --write .    # Fix auto-fixable issues
```

## Troubleshooting

- **Caching issues**: Run with `--force` to bypass turbo cache (e.g., `pnpm turbo build --force`)
- **Incremental build errors**: Remove `*.tsbuildinfo` files (`find . -name '*.tsbuildinfo' -delete`)

## Architecture

GTKX renders React components as native GTK4 widgets through a two-thread Rust FFI bridge.

### Data Flow

```
React JSX → React Reconciler → HostConfig → Node Tree → WidgetNode
    → SignalStore → FFI Batch Layer → Rust Native Module → GTK Thread → Native Widgets
```

### Package Structure

| Package   | Purpose                                                             |
| --------- | ------------------------------------------------------------------- |
| `react`   | React reconciler, JSX components, `render()` entry point            |
| `ffi`     | Generated TypeScript FFI bindings, batching, lifecycle              |
| `native`  | Rust/Neon module: two-thread model, libffi calls, value marshalling |
| `codegen` | Generates FFI/React bindings from GIR files                         |
| `gir`     | GObject Introspection XML parser                                    |
| `cli`     | Scaffolding, Vite-based dev server with HMR                         |
| `css`     | CSS-in-JS styling adapted for GTK                                   |
| `testing` | Component testing utilities (like Testing Library)                  |
| `vitest`  | Vitest plugin for Xvfb display management                           |

### Key Files

- `packages/react/src/render.tsx` - App lifecycle, `render()`/`update()`/`quit()`
- `packages/react/src/host-config.ts` - React Reconciler HostConfig implementation
- `packages/react/src/node.ts` - Base Node class with specialized subclasses
- `packages/react/src/nodes/widget.ts` - WidgetNode: props, children, signals
- `packages/react/src/nodes/internal/signal-store.ts` - Central signal connection management
- `packages/react/src/factory.ts` - Node creation with priority-based class selection
- `packages/ffi/src/batch.ts` - FFI call batching optimization
- `packages/ffi/src/native/lifecycle.ts` - GTK app start/stop
- `packages/native/src/lib.rs` - Rust FFI exports (start, stop, call, batchCall)
- `packages/native/src/value.rs` - JS ↔ GLib value conversion

### Two-Thread Model

- **JS Thread**: Node.js, React reconciliation, all JavaScript
- **GTK Thread**: Spawned by native module, runs GTK main loop
- Communication via `gtk_dispatch` (JS→GTK) and `js_dispatch` (GTK→JS callbacks)

### Signal Blocking

During React commits, signals are blocked (`SignalStore.blockAll()`) to prevent handlers firing while the tree is being updated. Unblocked in `resetAfterCommit()`.

### Batching

Void-returning FFI calls are queued and executed together to reduce JS↔Native round-trips. Use `batch()` wrapper or manual `beginBatch()`/`endBatch()`.

### Node Priority System

Specialized nodes (ListItemNode, StackNode, etc.) have higher priority than the default WidgetNode. The factory uses `NodeClass.matches()` to select the appropriate handler.

### Container Predicates

Child management uses runtime method detection:

- `isAppendable()` → `widget.append(child)`
- `hasSingleContent()` → `widget.setContent(child)`
- `isSingleChild()` → `widget.setChild(child)`

### Code Generation

GIR files in `girs/` → `packages/gir` parser → `packages/codegen` → generates:

- `packages/ffi/src/generated/*` - FFI wrappers for each GTK namespace
- `packages/react/src/generated/*` - JSX types, namespace registry, widget metadata

Run `pnpm turbo codegen` after modifying GIR files or codegen templates.

## Code Style

- Biome: 4 spaces, 120 char line width, double quotes, semicolons required
- Rust: Standard conventions, Clippy warnings are CI errors
- TypeScript strict mode enabled
