---
title: "Architecture"
description: "How GTKX's generated bindings, React renderer, TypeScript runtime, and Rust native bridge fit together."
---

# Architecture

GTKX runs React applications in Node.js and renders their interface through native Adwaita and GTK4 objects. React owns component state and reconciliation. Adwaita supplies application structure and adaptive patterns; GTK4 supplies widgets, layout, input, accessibility, and rendering. GTKX connects those systems through generated JavaScript bindings and a Rust native addon.

This section describes GTKX 2 and the package boundaries set by its [development principles](/contributing/principles). Use this page to locate code, then follow the [code generation](/contributing/code-generation), [native runtime](/contributing/native-runtime), and [React renderer](/contributing/react-renderer) pages for the implementation details.

## The core layers

| Layer | Current implementation role | Implementation |
| --- | --- | --- |
| Application components | Describe the interface, hold application state, and compose GTKX features. | Application TSX and packages such as `@gtkx/components` and `@gtkx/navigation`. |
| Generated JSX | Expose typed React components for the project's native types and retain their GI classes. | Project-generated `@gtkx/jsx/<namespace>` modules. |
| React renderer | Create native objects, apply prop changes, route children, connect signals, and tear down mounted instances. | [`packages/react`](https://github.com/gtkx-org/gtkx/tree/main/packages/react). |
| Generated GI bindings | Expose native classes, interfaces, records, enums, callbacks, and functions, and register property and signal metadata with their classes. | Project-generated `@gtkx/gi/<namespace>` modules. |
| TypeScript runtime | Convert arguments and results, wrap native values, register types, and coordinate callbacks, signals and application lifecycle. | [`packages/runtime`](https://github.com/gtkx-org/gtkx/tree/main/packages/runtime). |
| Native bridge | Allocate and protect native storage, invoke C symbols and callback entry points, and integrate GLib with Node's event loop. | [`packages/native`](https://github.com/gtkx-org/gtkx/tree/main/packages/native). |
| Native libraries | Implement the actual GNOME application and widget behavior. | Adwaita, GTK4, GIO, GObject, GLib, and the project's additional libraries. |

The generated GI layer also works without React. A native function call or a registered GObject subclass can use the runtime directly; it does not need to pass through the reconciler. Conversely, a component library usually works through the JSX and GI APIs and does not need to know how the native addon represents a pointer.

## Generation and execution

GTKX separates information obtained from GObject Introspection Repository files, or GIR files, from operations performed while the application runs.

During generation, `@gtkx/codegen` reads the configured GIR libraries and their transitive dependencies. It determines JavaScript names, TypeScript types, callable signatures, transfer rules, and the metadata needed by the renderer. It emits two linked package stores, `@gtkx/gi` and `@gtkx/jsx`, plus a project reference when enabled.

During execution, Node imports those generated ESM modules, including their actual class definitions and method implementations. Their wrappers and descriptors drive `@gtkx/runtime` and the native bridge, which resolve symbols in the installed shared libraries and call them through libffi. Native type lookup and GObject property operations still happen at runtime. `@gtkx/runtime` has no knowledge of libgirepository: consumers supply all call descriptors and shapes, and GIR analysis belongs to generation.

This distinction explains why generated imports are local project artifacts. The project's library selection and GIR versions define the available API. Changing a GIR search path changes generated declarations; it does not install a native library that implements those declarations. See [Configuration and Codegen](/v2/guide/configuration-and-codegen) for the application-facing configuration.

The entry points for this boundary are the [codegen runner](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/runner.ts), the [runtime callable adapter](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/fn.ts), and the [native binding API](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/bind.rs).

## A render and an interaction

Consider a component that renders a button and updates a label when the button is clicked. Its path through GTKX is:

1. The generated JSX component turns its props into a React host element identified by its GType name. Element-valued props become named child slots.
2. React reconciles the tree and asks GTKX's host configuration to create or update an instance.
3. The renderer uses generated metadata and registered element behaviors to construct the native object, apply values, and place children through the appropriate container API.
4. Generated GI methods describe the native calls. Runtime converts their arguments, and the Rust addon prepares native storage and invokes the underlying C functions.
5. GTK delivers the button's signal through the GLib main context. The runtime calls the connected JavaScript handler, and the renderer gives that handler React's discrete event priority.
6. The handler changes React state. React reconciles again, and the renderer updates the existing native label where the element's identity permits reuse.

There are two related trees: React's component tree and the native object tree. Function components have no native object of their own. Named slots and parent-created page objects introduce additional routing, and portals can place a native object outside its surrounding React subtree while preserving React context. The [renderer page](/contributing/react-renderer) explains those differences.

## One owning event-loop thread

The native addon acquires GLib's default main context on the Node thread that initializes it. It integrates that context with libuv using prepare, timer, and file-descriptor polling handles. Node remains the outer event loop, allowing Node I/O, timers, promises, React scheduling, and GLib sources to make progress in the same application process.

Application startup is adapted to that arrangement. GTKX invokes GLib's local command-line handling to register and activate an application without entering a blocking `g_application_run()` loop. The application keeps the Node loop alive while active, and its teardown releases that hold. React's application component waits for activation before rendering its children.

The owning-thread requirement extends to native wrappers and widget operations. Worker threads are useful for computation with plain data, which can be sent back to the owning thread. They are not additional GTK render threads. Details and source links are in [Native Runtime](/contributing/native-runtime).

## State and ownership

Three forms of lifetime meet in an application:

| Lifetime | Owner | GTKX's role |
| --- | --- | --- |
| Component lifetime | React's tree, keys, and effects. | Mount, update, and unmount host instances; release renderer handlers and behaviors. |
| JavaScript wrapper lifetime | JavaScript reachability and native wrapper references. | Preserve wrapper identity for tracked native objects and associate wrappers with native handles. |
| Native allocation lifetime | GObject reference counts or each native type's copy, reference, and free operations. | Honor ownership descriptors and release allocations through the correct mechanism. |

Unmounting a component removes its placement and renderer-managed connections. It does not imply that every JavaScript reference to the object has vanished or that every native reference count has reached zero. Windows and dialogs also have explicit presentation and close behavior. Memory bugs therefore require examining both the React lifetime and the native ownership contract.

Likewise, a controlled prop and a native widget property are two representations of state. Writing a prop can itself emit a native signal. The renderer tracks its own mutations and suppresses configured user-event signals caused by those writes so they do not become feedback loops. Genuine user input continues through the connected handler.

## Finding the responsible layer

| Observable problem | Start reading |
| --- | --- |
| A generated method has an incorrect type, argument order, or return shape. | `packages/codegen/src/gir`, `analysis`, and `store/gi`. |
| A correctly described call produces an invalid value or loses native memory. | `packages/runtime/src/fn.ts`, then `packages/native/src/ffi/codec` and `handle.rs`. |
| A JSX prop is missing or has the wrong type. | `packages/codegen/src/store/jsx` and `packages/react/src/element-config.ts`. |
| A prop type is correct but the widget receives the wrong update. | `packages/react/src/reconciler/apply-props.ts` and the registered element behaviors. |
| A child appears in the wrong place, disappears, or fails to reorder. | `packages/react/src/reconciler/child-routing.ts` and `placement.ts`. |
| Signals, timers, or shutdown stop making progress. | `packages/runtime/src/lifecycle.ts` and `packages/native/src/runloop.rs`. |

Follow a failure across these boundaries before deciding where a fix belongs. A renderer symptom can begin in generated metadata, and a native ownership failure can begin in an incorrect GIR annotation. The source location is a starting point for investigation; the [package boundaries](/contributing/principles#keep-the-native-module-minimal) determine where the implementation belongs.
