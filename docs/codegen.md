# Code generation

`@gtkx/codegen` is the build-time generator that turns GObject-Introspection (GIR) XML — and, on a separate offline path, the Khronos OpenGL registry — into the typed TypeScript the runtimes consume. From GIR it emits two binding stores: the low-level FFI bindings (`@gtkx/gi`) and the React/JSX bindings plus reconciler metadata (`@gtkx/jsx`). The generated code is written entirely in terms of the `@gtkx/ffi` runtime's Type-descriptor vocabulary and a fixed set of imported runtime helper names. Those surfaces are the contract: codegen decides the shape, and `@gtkx/ffi`, `@gtkx/native`, and `@gtkx/react` implement what it emits.

This doc covers the generator only. How the emitted artifacts are consumed at runtime lives in [./rendering.md](./rendering.md); the config schema and the `virtual:gtkx-config` module live in `@gtkx/config`; the CLI that invokes the generator and decides when to run it is covered in [./cli.md](./cli.md). Setup and commands for humans live in [../README.md](../README.md). The whole-system picture lives in [./architecture.md](./architecture.md).

The generated stores are never hand-edited. To change them, change the codegen emitters or `gtkx.config.ts` and regenerate.

## Inputs and run flow

The generator is driven by the library list, the GIR search path, output options for the `gi` and optional `jsx` stores, and the user binding tables. A run:

1. Loads a type model from the requested libraries and GIR search path.
2. Emits one FFI module per namespace and writes the `@gtkx/gi` store.
3. If JSX output is requested, emits the React/JSX modules plus a metadata module and writes the `@gtkx/jsx` store.

The GL path is independent: a standalone offline script against the vendored Khronos registry.

## The type model

GIR loading walks the transitive closure of the requested libraries by following each file's include headers and locating each namespace on the search path. Loading is two-phase — discover and register every namespace, then populate every namespace body — so that forward references and cross-namespace references resolve uniformly regardless of file order.

Types are not referenced by name in the model. Each reference is a stable handle into a per-namespace pool of declarations. A reference seen before its declaration exists is interned as an undefined stub at a stable slot, and the populate pass fills that slot in. Shared scalar structural types (primitives, varargs) are deduplicated in one reserved pool; anonymous containers (C arrays, GLib lists, hash tables) and inline callbacks are interned per namespace without deduplication.

Because resolution is two-phase, any reader must tolerate a reference that resolves to nothing — a not-yet-resolved or non-introspectable type. The writers fall back to a generic object descriptor (or `void`) in that case.

Parsed GIR is normalized into records carrying the GObject metadata the writers need: type names, get-type symbols, ref/unref or copy/free functions, C type names, and per-member annotations (direction, transfer ownership, nullability, callback scope, closure and destroy indices).

## Emit layer

A thin code-assembly layer sits between the type model and the writers. It accumulates a module's bindings, declarations, and registrations, mediates imports (runtime, native, cross-namespace, side-effect, and GObject bootstrap), hoists shared descriptor expressions, qualifies cross-namespace identifiers, and renders everything to a single ordered source string. Import ordering and the injected side-effect imports (GObject bootstrap, and a non-foundational namespace's barrel) are part of the generated contract, not incidental.

## FFI store emission (`@gtkx/gi`)

One module is emitted per namespace, with classes ordered so that a class's parent is declared before it. Each entity contributes three things to its module:

- **Bindings** — descriptor expressions that name a C symbol and describe its signature.
- **Declarations** — the exported TypeScript class, interface, function, or type.
- **Registrations** — the calls that associate a wrapper class with its GType (and its virtual functions) plus per-namespace init/finalize bootstrap.

### The Type-descriptor contract

The center of the FFI contract is the mapping from each GIR type to a runtime Type descriptor — the marshalling vocabulary `@gtkx/ffi` implements. Primitives, GObject classes and interfaces, boxed records and unions, enums and bitfields, C and GLib containers, hash tables, callbacks, and out/inout cells each map to a descriptor that captures their layout and ownership. Ownership (borrowed vs. full) is derived from GIR transfer-ownership annotations and selects the runtime's ref/sink/unref behavior. A GType is bound from a class's get-type symbol, or resolved at runtime by type name when no get-type exists.

### Call planning and marshalling

The method writer plans each call's parameter descriptors and runtime argument expressions. It distinguishes in, out, inout, and caller-allocated parameters; folds a C array's length parameter out of the generated signature (so the TS arity deliberately differs from the C arity); elides closure, destroy, and user-data parameters for callbacks; passes wrapper instances as their opaque handle; and promotes an async function paired with its finish sibling into a method returning a `Promise`.

### Runtime helper names

Beyond the Type-descriptor DSL, generated FFI modules import a fixed set of helper names that `@gtkx/ffi` and `@gtkx/native` export — for GObject construction and wrapper binding, signal connect/emit, wrapper-class registration, namespace bootstrap, and handle extraction. These names are the runtime-side half of the contract and change in lockstep with the generator.

### Template overrides

Types that cannot be generated faithfully have hand-written runtime overrides, copied verbatim into the `gi` store alongside the generated modules and re-exported beside them. A few member-level substitutions are applied in place by the class writer.

## React/JSX store emission (`@gtkx/jsx`)

The JSX pipeline merges the built-in binding tables with the user tables from config, then finds every namespace containing a React-node class — a class descending from `GObject`. It emits one module per such namespace plus one global metadata module.

Each namespace module contains:

- **Intrinsic element constants** — one per node not owned by a compound or runtime wrapper.
- **Props interfaces** — built from each class's own, inherited, and implemented-interface properties; signals become handler props; settable GObject-valued properties widen into element slots; array, object, and virtual props from the tables are added with their item types; container-prop methods become child slots. Parent props are extended from the parent's interface.
- **Compound components** — element factories, optionally wrapped by application/window/top-level HOCs based on ancestry. Some widget families (lists, grids, columns, dropdowns) are instead emitted as typed wrappers backed by runtime HOCs imported from `@gtkx/react`, and a few are emitted as direct re-exports or typed-props wrappers.
- **Virtual subcomponents** — wrapper-node elements that carry no GObject and express non-parenting relationships (stack/notebook pages, fixed/overlay children, text anchors).
- A global augmentation of the JSX intrinsic-elements interface.

The prop interfaces and the FFI declarations share one type-rendering engine driven by different targets — the React target widens callbacks and routes GType to the GObject GType type, while the FFI target qualifies cross-namespace names — so type rendering stays consistent across both surfaces.

### Reconciler metadata

The built-in declarative rules are merged with the user tables and baked into the metadata module that the `@gtkx/react` reconciler reads at runtime. These tables drive signal wiring, construct-time and default property handling, the mapping from element type to widget, array/object/virtual prop handling, top-level and signal-blocking classification, and container/child attachment. The row types come from `@gtkx/config`, so one schema types both the JSX prop interfaces and the metadata values. Default property values are resolved into TS literals the reconciler uses to revert a prop on removal.

## Writing the stores

A store is materialized as a real, resolvable installed package. Each generated module is transpiled in isolation to JavaScript and declarations (no cross-file checking; an individually-invalid module fails the whole store write). A manifest is written with a subpath exports map (one entry per namespace plus the JSX metadata entry), and relative symlinks to the real runtime packages and a self-link make the generated imports resolve as installed packages. The store is assembled completely in a temp directory and then swapped into place atomically, so a partial store never becomes visible.

## Freshness

A run records a content hash over the codegen version, the library list, the serialized user tables, and the contents of every GIR file in the repository. The CLI compares this hash against the one stored beside the previous store to decide whether regeneration is needed; unchanged inputs skip the whole run.

## Khronos GL path

A self-contained offline pipeline parses the vendored OpenGL XML registry and emits a static GL binding module. It selects the command and enum subset for a target API, version, and profile by resolving the registry's require/remove closure; classifies each command parameter's C type and each return into a marshalling plan; and renders each command as a typed wrapper function using the same Type descriptors, plus derived singular helpers for the generate/create/delete families. Commands that cannot be modeled (callbacks, computed output lengths) are excluded with a recorded reason, and a few are deferred to a hand-written companion module. The result is written into the sibling `@gtkx/gl` package, with generated export names asserted disjoint from each other and from the companion.
