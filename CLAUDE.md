# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** This document is for **contributors and AI assistants** working on the GTKX codebase itself. If you're building an application with GTKX, see the [documentation](https://eugeniodepalo.github.io/gtkx/) instead.

# GTKX

React framework for building native GTK4 desktop applications on Linux.

## Architecture

```
React Components (JSX)
        ↓ props, callbacks
@gtkx/react (reconciler)
        ↓ widget operations
@gtkx/ffi (TypeScript bindings)
        ↓ FFI calls
@gtkx/native (Rust/Neon)
        ↓ GTK4 C API
Native GTK4 Widgets
```

**Data flow:**

- Props flow down: React state → reconciler → call() → GTK widget properties
- Events flow up: GTK signals → FFI callbacks → React event handlers

## Package Structure

```
packages/
├── react/      # React reconciler, JSX components, render()
├── ffi/        # Generated TypeScript FFI bindings to native module
├── native/     # Rust native module (Neon) - GTK4 bridge
├── cli/        # `gtkx` CLI - project scaffolding, dev server with HMR
├── codegen/    # Generates FFI/JSX bindings from GIR files
├── gir/        # GObject Introspection XML parser
├── css/        # CSS-in-JS styling system (Emotion-based)
├── testing/    # Component testing utilities
└── e2e/        # End-to-end tests
```

## Key Entry Points

| File                                | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `packages/react/src/render.tsx`     | `render()` function, `ApplicationContext` |
| `packages/react/src/host-config.ts` | React reconciler implementation           |
| `packages/react/src/nodes/*.ts`     | Widget node handlers (30+ widgets)        |
| `packages/native/src/lib.rs`        | Rust FFI exports                          |
| `packages/ffi/src/index.ts`         | JavaScript FFI wrapper                    |
| `packages/cli/src/create.ts`        | Project scaffolding                       |
| `packages/cli/src/dev-server.tsx`   | Development server with HMR               |

## Native FFI Functions

Exported from `@gtkx/native`:

| Function                        | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `start(appId)`                  | Initialize GTK application                |
| `stop()`                        | Shutdown GTK application                  |
| `call(method, args)`            | Invoke a GTK method                       |
| `batchCall(calls)`              | Multiple operations in one FFI round-trip |
| `alloc(type)`                   | Allocate a boxed type                     |
| `read(objectId, type, offset)`         | Read value from boxed memory              |
| `write(objectId, type, offset, value)` | Write value to boxed memory               |
| `getObjectId(object)`           | Get internal object ID                    |
| `poll()`                        | Process GTK events                        |

## Commands

```bash
pnpm build           # Build all packages
pnpm codegen         # Regenerate FFI bindings from GIR files
pnpm test            # Run test suite (uses xvfb locally)
pnpm lint            # Lint TypeScript (Biome) and Rust (Clippy)
pnpm docs            # Build documentation website
pnpm knip            # Check for dead code
```

Build/test a specific package:

```bash
pnpm --filter @gtkx/react build
pnpm --filter @gtkx/react test
```

Run a single test file:

```bash
pnpm --filter @gtkx/e2e test tests/button.test.tsx
```

Fix lint issues:

```bash
pnpm biome check --write .
```

## Examples

```
examples/
├── hello-world/   # Minimal counter app
├── todo/          # Complete todo app - state, lists, Adwaita styling
├── gtk-demo/      # Full replica of official GTK demo
└── deploying/     # Flatpak packaging
```

Run an example:

```bash
cd examples/todo
pnpm install
pnpm dev
```

## Key Concepts

### Widgets

GTK widgets map to React components prefixed with `Gtk` or `Adw`:

```tsx
<GtkButton label="Click" onClicked={() => {}} />
<GtkLabel label="Text" cssClasses={["title-1"]} />
<AdwHeaderBar />
```

### Slots

Named child positions for GTK's slot-based layout:

```tsx
<GtkHeaderBar>
  <Slot for={GtkHeaderBar} id="titleWidget">
    Title
  </Slot>
</GtkHeaderBar>
```

### Application Window

Every app needs a window with close handling:

```tsx
<GtkApplicationWindow title="App" onCloseRequest={quit}>
  {children}
</GtkApplicationWindow>
```

### Rendering

Mount your app with `render()`:

```tsx
import { render } from "@gtkx/react";
render(<App />, "com.example.app");
```

## Development Patterns

- Use `useState`, `useEffect`, and other React hooks normally
- GTK enums come from `@gtkx/ffi/gtk` (e.g., `Gtk.Orientation.VERTICAL`)
- CSS classes use `cssClasses={["class1", "class2"]}` prop
- Adwaita classes: `title-1` through `title-4`, `dim-label`, `suggested-action`, etc.

## Testing

Use `@gtkx/testing` for component tests:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";

test("button click", async () => {
  await render(<MyComponent />);
  const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "my-button" });
  await userEvent.click(button);
  const result = await screen.findByTestId("result");
  expect((result as Gtk.Label).getLabel()).toBe("clicked");
});
```

## Code Generation

FFI bindings are auto-generated from GObject Introspection files:

```
girs/*.gir  →  @gtkx/codegen  →  packages/ffi/src/generated/
```

Regenerate after updating GIR files:

```bash
pnpm run codegen
```

## Tech Stack

- **Frontend:** React 19, TypeScript
- **Native:** Rust, Neon (Node.js native modules)
- **Target:** GTK4, Adwaita (Libadwaita)
- **Build:** pnpm workspaces, Turborepo, Vite
- **Test:** Vitest (runs under xvfb with `pool: "forks"`)
- **Lint:** Biome (TypeScript), Clippy (Rust)

## Code Style

- **Indentation:** 4 spaces
- **Line width:** 120 characters
- **Quotes:** Double quotes
- **Semicolons:** Required
- Biome config in `biome.json`
- Clippy warnings are errors in CI
