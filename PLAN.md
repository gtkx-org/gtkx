# Test Rewrite Plan

## Overview

Rewrite all tests in the codebase with a consistent approach: one test file per unit exposed to end users.

## Test Guidelines

### What to Test

- **Only test public APIs** - Functions, classes, and components that are exported and intended for end-user consumption
- **Never test internal/private functions** - If it's not exported or is an implementation detail, don't test it directly
- **Test through the public interface** - Internal behavior should be verified through the public API that uses it

### Test File Organization

- **One test file per unit** - Each publicly exported unit (function, class, or component) should have its own dedicated test file
- **Naming convention** - Test files should use kebab-case and be named after the unit they test (e.g., `get-object.test.ts` for `getObject`, `native-error.test.ts` for `NativeError`)

### Test Structure

Each test file should follow this structure:

```typescript
describe("UnitName", () => {
    // Happy path tests at the root level (no nested describe)
    it("does the main thing correctly", () => {});
    it("handles valid input A", () => {});
    it("handles valid input B", () => {});

    // Only group edge cases and error handling
    describe("edge cases", () => {
        it("handles boundary condition", () => {});
        it("handles unusual but valid input", () => {});
    });

    describe("error handling", () => {
        it("throws on invalid input", () => {});
        it("handles failure gracefully", () => {});
    });

    // Memory leak tests only if applicable
    describe("memory leaks", () => {
        it("cleans up resources on unmount", () => {});
    });
});
```

### Test Categories

For each unit, include tests for:

1. **Happy path** - Normal, expected usage (at root describe level)
2. **Edge cases** - Boundary conditions, unusual but valid inputs (grouped)
3. **Error handling** - Invalid inputs, failure scenarios (grouped)
4. **Memory leaks** - Resource cleanup, if applicable (grouped)

### Mocking Policy

- **Never mock** unless done for performance or isolation purposes
- **Allowed mocks**:
  - `memfs` - In-memory filesystem for isolated file system tests (avoids polluting real filesystem)
  - External services that would be slow or unreliable in tests
- **Not allowed**: Mocking internal modules, GTK/FFI bindings, or other code under test

### Testing Tools

- **vitest** - Test runner
- **memfs** - In-memory filesystem for isolated file system tests

---

## Package: @gtkx/cli

### Public API

The CLI exposes:
1. `gtkx create` command (via `createApp()` function)
2. `gtkx dev` command (via `createDevServer()` function)
3. Utility functions: `isValidProjectName`, `isValidAppId`, `getTestScript`, `getAddCommand`, `getRunCommand`, `generatePackageJson`, `generateTsConfig`

### Test Files

```
packages/cli/tests/
├── create.test.ts    # createApp() and utility functions
└── dev-server.test.ts # createDevServer()
```

### Status: ✅ Complete (91 tests)

---

## Package: @gtkx/react

### Public API

TODO: Document public exports

### Test Files

TODO: Plan test files

### Status: ⏳ Pending

---

## Package: @gtkx/ffi

### Public API

The FFI package exposes:
1. `start` - Starts the GTK application with the given application ID
2. `stop` - Stops the GTK application and cleans up
3. `getCurrentApp` - Gets the current GTK application instance
4. `events` - EventEmitter for GTK lifecycle events ("start", "stop")
5. `getObject` - Wraps a native pointer in a class instance using GLib type system
6. `getBoxed` - Wraps a native boxed type pointer in a class instance
7. `getInterface` - Wraps a native pointer as an interface instance
8. `registerType` - Registers a class in the global GObject type registry
9. `call` - Calls a native GTK function via FFI
10. `beginBatch` - Begins batching mode for FFI calls
11. `endBatch` - Ends the current batch level and executes queued calls
12. `isBatching` - Checks if batching mode is active
13. `isInstantiating` - Flag to prevent intermediate base class constructors from creating objects
14. `setInstantiating` - Sets the instantiation flag
15. `createRef` - Creates a ref object (re-exported from @gtkx/native)
16. `getObjectId` - Returns the native pointer from an object (re-exported from @gtkx/native)
17. `NativeError` - Error class that wraps a GLib GError

Note: Generated bindings in `./gtk`, `./gdk`, `./gio`, etc. are auto-generated and tested through the public API.

### Test Files

```
packages/ffi/tests/
├── start.test.ts           # start()
├── get-current-app.test.ts # getCurrentApp()
├── events.test.ts          # events
├── get-object.test.ts      # getObject()
├── get-boxed.test.ts       # getBoxed()
├── get-interface.test.ts   # getInterface()
├── register-type.test.ts   # registerType()
├── call.test.ts            # call()
├── batch.test.ts           # beginBatch(), endBatch(), isBatching()
├── instantiating.test.ts   # isInstantiating, setInstantiating()
├── create-ref.test.ts      # createRef()
├── get-object-id.test.ts   # getObjectId()
├── native-error.test.ts    # NativeError
└── codegen/                        # Tests for generated FFI bindings
    ├── class-construction.test.ts  # GObject class instantiation
    ├── methods.test.ts             # Instance and static methods
    ├── properties.test.ts          # Getter/setter properties
    ├── signals.test.ts             # Signal connection
    ├── boxed-types.test.ts         # Stack-allocated boxed types
    ├── interfaces.test.ts          # GObject interfaces
    ├── enums.test.ts               # Enum and flags types
    ├── functions.test.ts           # Namespace-level functions
    ├── constants.test.ts           # Generated constants
    ├── cross-namespace.test.ts     # Cross-namespace type usage
    ├── ref-parameters.test.ts      # Ref<T> output parameters
    ├── async-methods.test.ts       # Promise-returning async methods
    ├── error-handling.test.ts      # NativeError and GError handling
    ├── static-factory-methods.test.ts  # Static factory constructors
    ├── nullable-returns.test.ts    # Nullable return types
    ├── array-returns.test.ts       # Array return types
    └── callbacks.test.ts           # Callback parameters
```

### Status: ✅ Complete (202 tests)

---

## Package: @gtkx/css

### Public API

The CSS package exposes:
1. `css` - Creates CSS class names from styles and injects them into GTK's CssProvider
2. `cx` - Merges multiple class names, filtering out falsy values
3. `injectGlobal` - Injects global CSS styles

### Test Files

```
packages/css/tests/
└── css.test.ts    # css(), cx(), injectGlobal()
```

### Status: ✅ Complete (23 tests)

---

## Package: @gtkx/testing

### Public API

TODO: Document public exports

### Test Files

TODO: Plan test files

### Status: ⏳ Pending

---

## Package: @gtkx/gir

### Public API

TODO: Document public exports

### Test Files

TODO: Plan test files

### Status: ⏳ Pending

---

## Package: @gtkx/native

### Public API

TODO: Document public exports (Rust native module)

### Test Files

TODO: Plan test files

### Status: ⏳ Pending
