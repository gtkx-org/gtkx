# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTKX is a framework for building native Linux desktop applications using React 19 and TypeScript. Components render as native GTK4 widgets through a Rust FFI bridge (Neon) — no webviews or Electron.

## Commands

```bash
pnpm build # Build all packages
pnpm test # Run all tests (requires Xvfb, handled automatically)
pnpm lint # Run Biome + Rust Clippy
pnpm knip # Check for dead code
pnpm codegen # Regenerate FFI bindings from GIR files
pnpm biome check --write . # Auto-fix linting issues

# Package-specific commands
pnpm --filter @gtkx/react build
pnpm --filter @gtkx/react test

# Documentation
pnpm docs # Build documentation site
cd website && pnpm start # Local docs preview
```

## Architecture

### Layer Stack

```
React Components (@gtkx/react)
 ↓
React Reconciler (host-config.ts)
 ↓
FFI Bindings (@gtkx/ffi) — auto-generated from GIR
 ↓
Rust Native Module (@gtkx/native)
 ↓
GTK4 Widgets
```

### Two-Thread Model (packages/native)

The native module uses two threads to satisfy GTK's single-threaded requirements:

- **JS Thread**: Handles JavaScript calls, argument conversion, callback dispatch
- **GTK Thread**: Runs GTK main loop, executes widget operations
- Communication: `gtk_dispatch` (JS→GTK) and `js_dispatch` (GTK→JS)

### Key Entry Points

| File | Purpose |
|------|---------|
| `packages/react/src/render.tsx` | `render()` function, app initialization |
| `packages/react/src/host-config.ts` | React reconciler implementation |
| `packages/native/src/lib.rs` | Rust FFI exports (start, stop, call, poll, etc.) |
| `packages/ffi/src/index.ts` | JavaScript FFI wrapper |

### Code Generation Pipeline

GIR XML files (girs/) → @gtkx/gir parser → @gtkx/codegen → Generated TypeScript

Output locations:
- `packages/ffi/src/generated/` — FFI type bindings
- `packages/react/src/generated/` — React JSX component wrappers

Run `pnpm codegen` after modifying GIR files or codegen templates.

## Monorepo Structure

| Package | Description |
|---------|-------------|
| `@gtkx/react` | React reconciler and JSX components |
| `@gtkx/ffi` | Generated TypeScript FFI bindings |
| `@gtkx/native` | Rust/Neon native module (GTK4 bridge) |
| `@gtkx/cli` | Scaffolding, dev server with HMR |
| `@gtkx/codegen` | Generates bindings from GIR files |
| `@gtkx/gir` | GObject Introspection XML parser |
| `@gtkx/css` | CSS-in-JS styling for GTK |
| `@gtkx/testing` | Component testing utilities |
| `@gtkx/vitest` | Vitest plugin for Xvfb display management |
| `@gtkx/mcp` | MCP server for AI-powered app interaction |

## Code Style

- **Indentation**: 4 spaces
- **Line width**: 120 characters
- **Quotes**: Double quotes
- **Semicolons**: Required
- **Arrays**: Use shorthand syntax (`string[]` not `Array<string>`)
- **TypeScript**: Strict mode enabled
- **Rust**: All Clippy warnings treated as errors

## Testing

Tests run under Xvfb (virtual framebuffer) for headless GUI testing. The `@gtkx/vitest` plugin automatically handles display setup and GTK environment variables.

## Build Dependencies

The build follows this task order via Turborepo:
1. `@gtkx/codegen` builds first
2. `//#codegen:run` generates FFI/React bindings
3. `@gtkx/ffi` and `@gtkx/react` build after codegen
4. Other packages depend on these core packages
