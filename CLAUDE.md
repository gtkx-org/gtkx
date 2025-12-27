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

| File | Purpose |
|------|---------|
| `packages/react/src/render.tsx` | `render()` function, `ApplicationContext` |
| `packages/react/src/host-config.ts` | React reconciler implementation |
| `packages/react/src/nodes/*.ts` | Widget node handlers (30+ widgets) |
| `packages/native/src/lib.rs` | Rust FFI exports |
| `packages/ffi/src/index.ts` | JavaScript FFI wrapper |
| `packages/cli/src/create.ts` | Project scaffolding |
| `packages/cli/src/dev-server.tsx` | Development server with HMR |

## Native FFI Functions

Exported from `@gtkx/native`:

| Function | Purpose |
|----------|---------|
| `start(appId)` | Initialize GTK application |
| `stop()` | Shutdown GTK application |
| `call(method, args)` | Invoke a GTK method |
| `batchCall(calls)` | Multiple operations in one FFI round-trip |
| `alloc(type)` | Allocate a boxed type |
| `read(objectId, field)` | Read boxed type field |
| `write(objectId, field, value)` | Write boxed type field |
| `getObjectId(object)` | Get internal object ID |
| `poll()` | Process GTK events |

## Commands

```bash
npm run build       # Build all packages
npm run codegen     # Regenerate FFI bindings from GIR files
npm run test        # Run test suite
npm run lint        # Lint with Biome
npm run docs        # Build documentation website
```

## Examples

```
examples/
├── todo/          # Complete todo app - state, lists, Adwaita styling
├── gtk4-demo/     # Widget showcase - buttons, lists, dialogs, menus
├── lists/         # List widgets and virtualization
├── adwaita/       # Libadwaita components
└── deploying/     # Flatpak packaging
```

Run an example:
```bash
cd examples/todo
npm install
npm run dev
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
import { render, screen } from "@gtkx/testing";

test("button click", async () => {
  render(<MyComponent />);
  await screen.findByName("my-button").click();
  expect(await screen.findByName("result")).toHaveLabel("clicked");
});
```

## Code Generation

FFI bindings are auto-generated from GObject Introspection files:
```
girs/*.gir  →  @gtkx/codegen  →  packages/ffi/src/generated/
```

Regenerate after updating GIR files:
```bash
npm run codegen
```

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9
- **Native:** Rust, Neon (Node.js native modules)
- **Target:** GTK4, Adwaita (Libadwaita)
- **Build:** pnpm, Turbo, Vite
- **Test:** Vitest
