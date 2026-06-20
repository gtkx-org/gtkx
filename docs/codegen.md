# Code generation

`@gtkx/codegen` is the build-time generator that turns GObject-Introspection (GIR) XML — and, on a separate offline path, the Khronos OpenGL registry — into the typed TypeScript the runtimes consume. From GIR it emits two stores of bindings: the low-level FFI bindings (`@gtkx/gi`) and the React/JSX bindings plus reconciler metadata (`@gtkx/jsx`). The generated code is written entirely in terms of the `@gtkx/ffi` runtime's `t.*` type-descriptor vocabulary and a fixed set of imported runtime helper names. Those two surfaces are the contract: codegen decides the shape, and `@gtkx/ffi` / `@gtkx/native` / `@gtkx/react` must implement what it emits.

This doc covers the generator only. How the emitted artifacts are consumed at runtime lives in the reconciler under `packages/react/src/reconciler/` and the runtime under `packages/ffi/src/`; the config schema and the `virtual:gtkx-config` module live under `packages/config/src/`; the CLI that invokes the generator and decides when to run it lives under `packages/cli/src/`. Setup and commands for humans live in [../README.md](../README.md). The whole-system picture lives in [./architecture.md](./architecture.md).

## Inputs and entry point

`CodegenRunner` is the package's primary export. It is constructed with the library list, the GIR search path, store options for the `gi` and optional `jsx` outputs, and the user binding tables. `run()`:

1. Loads a `GirRepository` from the libraries and GIR path.
2. Emits one FFI module per namespace and writes the `@gtkx/gi` store, tagged with a freshness fingerprint.
3. If `jsx` options are present, emits the React/JSX modules and metadata and writes the `@gtkx/jsx` store.

The GL path is not part of `CodegenRunner`; it is a standalone offline script driven by `generateGlModules` against the vendored registry XML.

## The GIR repository (arena type model)

`loadGirRepository` builds the transitive closure of the requested libraries by BFS-walking each GIR file's `<include>` headers, locating each `Name-Version.gir` on the search path. Loading is two-phase, which is what lets forward references and cross-namespace references resolve uniformly:

- **Discover + register**: each namespace header is parsed and a namespace shell is registered.
- **Populate bodies**: every namespace body is parsed into plain data records (classes, interfaces, boxeds, enums, callbacks, functions, constants, aliases).
- **Intern declarations**: every named entity is interned into its namespace's arena.

Types are not referenced by name in the model. Each reference is a small `TypeId = { nsId, id }` handle into a per-namespace **arena** (parallel arrays of types and names plus a name index). A reference encountered during body parsing that has no declaration yet is interned as an undefined **stub** at a stable id; the intern-declarations pass fills that slot in. A reserved `$internal` arena (ns id 0) interns and deduplicates only the shared scalar structural types — primitives and varargs — keyed by an index so each is addressable once. Anonymous containers (C arrays, GLib lists, hash tables) and inline callbacks are interned into the **current namespace's** arena instead, pushed anonymously with no name and no index entry, so they are addressable by id but are not deduplicated.

Because resolution is two-phase, any code reading the repository must tolerate `typeOf(tid)` returning `undefined` for a not-yet-resolved or non-introspectable reference. The writers have explicit undefined-type fallbacks (an undefined type renders as `t.object(...)` / `void`).

### Entity model notes

Parsed GIR is normalized into records that carry GObject metadata (`glib:type-name`, `glib:get-type`, ref/unref or copy/free funcs, `c:type`) and members with their annotations (direction, transfer-ownership, nullable, scope, closure/destroy indices). The XML adapter uses `fast-xml-parser` with a fixed set of multi-valued tags. One reserved-word collision is handled at parse time: the GIR `<constructor>` tag is renamed to `gir-constructor`, so any traversal must query that renamed tag.

## The emit DSL

A thin code-assembly layer sits between the entity model and the writers:

- **`ModuleContext`** wraps a `ModuleBuilder` together with the current namespace and the repository. It mediates imports — runtime (`@gtkx/ffi`), native (`@gtkx/native`), cross-namespace, side-effect, and GObject bootstrap — and hoists shared FFI-type expressions. `qualify(ns, name)` returns a local or namespace-qualified identifier. The cross-namespace side-effect import it can inject is added only for non-foundational namespaces; a foundational GObject/GLib reference gets a namespace import without a side effect.
- **`ModuleBuilder`** accumulates bindings, declarations, and registrations and renders them into a single ordered source string (imports, declarations, bindings, registrations). Only bindings are name-deduplicated (a name passed to `appendBinding` is dropped if already seen), which also covers the hoisted FFI-type constants since each is appended as a named binding under a deduplicated expression key. Declarations and registrations are pushed unconditionally and kept in append order.
- **`ImportsBuilder`** collects named / namespace / side-effect imports and renders them sorted and deduplicated, collapsing type-only imports.

GObject bootstrap and non-foundational cross-namespace imports get an injected side-effect import (the bootstrap of `object`/`value` overrides, or the imported namespace's barrel). Import ordering and these side effects are part of the generated contract, not incidental.

## FFI store emission (`@gtkx/gi`)

`generateNamespaceModule` produces one module per namespace. Classes are emitted in parent-topological order (so a class's parent expression is already declared) and the module is assembled in this order: enums, boxeds, classes, interfaces, callbacks, namespace functions, namespace bootstrap, constants, aliases.

Each writer turns an entity into three things on the module:

- **Bindings** — `t.bind(...)` / `t.fn(...)` expressions that name a C symbol and describe its signature.
- **Declarations** — the exported TypeScript class / interface / function / type.
- **Registrations** — `registerWrapperClass(Class, gtype, vfuncs?)` calls and namespace `init()` / `onExit(finalize)` bootstrap calls.

### The `t.*` type-descriptor contract

`writers/value.ts` is the center of the FFI contract: it maps each GIR type to a runtime `t.*` descriptor expression. This descriptor vocabulary is the stable boundary `@gtkx/ffi` must implement.

| GIR type | Descriptor |
| --- | --- |
| primitives | `t.int32`, `t.uint64`, `t.string(ownership)`, `t.biguint64` (gtype), … |
| class / interface | `t.object(ownership[, typeName])`, or `t.fundamental(lib, ref, unref, {...})` when ref/unref funcs exist |
| boxed (record/union) | `t.fundamental(...)`, `t.boxed(name, ownership, lib, getType, …)`, or `t.struct(ownership, { size, wrapperClass, callerAllocated })` |
| enum / bitfield | `t.enum(lib, getType, signed)` / `t.flags(...)`, or a plain int when no get-type |
| C array | `t.sizedArray(el, lenIndex, ownership)`, `t.fixedArray(el, n, ownership)`, or `t.array(el, "array", ownership)` |
| GLib containers | `t.list` / `t.slist` / `t.ptrArray` / `t.garray` / `t.byteArray` |
| GHashTable | `t.hashTable(key, value, ownership)` |
| callback | `t.callback([argTypes], ret, { hasDestroy?, userDataIndex?, scope? })` |
| out / inout cell | `t.ref(inner[, isInout])` |

Ownership (`"borrowed"` vs `"full"`) is derived from GIR `transfer-ownership` (`full`/`container` → `full`, otherwise borrowed) and selects the runtime's ref/sink/unref behavior. GType bindings come from `writers/gtype-binding.ts`: a class's get-type symbol is bound as `t.bind(lib, get_type, [], t.biguint64)`; a type-name-only class resolves its GType at runtime through a `g_type_from_name` binding against the GObject SONAME.

### Call planning and marshalling

`writers/method.ts` plans each call's parameter descriptors and the runtime argument expressions. It handles:

- **in / out / inout / caller-allocated** parameters, emitting `direction` / `callerAllocates` / `consumed` flags on each parameter literal.
- **Array-length folding** — a C array's length parameter is derived from the array's `.length` and is dropped from both the generated signature and the return tuple, so the generated TS arity deliberately differs from the C arity.
- **Closure / destroy / user-data elision** for callback parameters.
- **Handle passing** — wrapper instances are passed as their opaque handle via `getHandle` / `tryGetHandle`; arrays and hashtables of handles are mapped element-wise.
- **Async-to-Promise promotion** — an async function paired with its `_finish` sibling is rendered as a method returning a `Promise`, built through the runtime `promisify` helper.

### Runtime helper names imported by generated code

Beyond `t`, generated FFI modules import a fixed set of helpers that `@gtkx/ffi` and `@gtkx/native` must export. The construction path imports `getInstanceGtype`, `newGobjectWithProperties`, `setHandle` (from ffi) and `setWrapper` (from native); the root `GObject.Object` constructor binds the instance to a freshly-constructed GObject and records the wrapper. Signals import `connectGobjectSignal`, `emitGobjectSignal`, and `signalBaseName`; class registration imports `registerWrapperClass`; namespace bootstrap imports `onExit`; calls import `getHandle` / `tryGetHandle`. These names are the runtime-side half of the contract.

### Template overrides

Some types cannot be generated faithfully and have hand-written runtime overrides under `templates/<namespace>/overrides/`, with a barrel `index.ts` per namespace. These are copied verbatim into the `gi` store alongside the generated module (the barrel re-exports both). Two member-level overrides (`g_value_get_boxed` / `set_boxed`) are also substituted in place by the class writer.

## React/JSX store emission (`@gtkx/jsx`)

The JSX pipeline first merges built-in binding tables with the user tables from `gtkx.config`, then finds every namespace that contains a React-node class. A class is a **React node** if it descends (by ancestor glib name) from `GObject`. For each such namespace it emits one `.tsx` module, and globally it emits a single `metadata` module.

Each namespace module contains, from `react/jsx.ts` and `react/props.ts`:

- **Intrinsic element constants** — `export const GtkButton = "GtkButton" as const;` for each node not owned by a compound/runtime wrapper.
- **`XxxProps` interfaces** — built from the class's own, inherited, and implemented-interface properties; signals become `onXxx` handler props; settable GObject-class-valued properties are widened into `ReactElement` slots; array/object/virtual props from the tables are added with their item types; container-prop methods become `ReactNode` slots. Parent props are extended through `WidgetProps` or the parent's `XxxProps`.
- **Compound components** — `createElementComponent(name)`, optionally wrapped by `withApplication` / `withApplicationWindow` / `withTopLevel` HOCs based on ancestry. Certain widgets are instead emitted as typed wrappers backed by runtime HOCs imported from `@gtkx/react`: the list/grid/column/dropdown families (e.g. `GtkListView`, `GtkGridView`, `GtkDropDown`, `AdwComboRow`, `GtkColumnView`, `GtkColumnViewColumn`) emit `export const X: … = RuntimeX;` against an aliased HOC import. A true `export { X } from "@gtkx/react"` re-export applies only to specific cases (e.g. `GtkConstraintLayout`), and a few (e.g. `GMenu`) emit a typed-props wrapper.
- **Virtual subcomponents** — wrapper-node elements (stack/notebook pages, grid/fixed/overlay children, text anchors) that carry no GObject and express non-parenting relationships.
- A `declare global` augmentation of `React.JSX.IntrinsicElements`.

The props target reuses the same `renderBaseTypeFor` engine as the FFI module target, but through a different `TsTypeTarget`: the React target uses `Record` containers, widens callbacks and aliases, and routes GType to `GObject.GType`, while the FFI target qualifies cross-namespace names and uses `Map` containers. Sharing one renderer keeps type rendering consistent across the two surfaces.

### Reconciler metadata tables

`react/tables.ts` holds the built-in declarative rules; `react/metadata.ts` bakes them — merged with user tables — into the `metadata` module that the `@gtkx/react` reconciler reads at runtime. The emitted tables include `SIGNALS`, `CONSTRUCT_ONLY_PROPS`, `CONSTRUCT_PROPS`, `DEFAULT_PROPS`, `ELEMENT_MAP`, `ARRAY_PROPS` / `OBJECT_PROPS` / `VIRTUAL_PROPS`, `PROP_RULES`, `TOP_LEVEL_TYPES`, `DEFAULT_BLOCKABLE_TYPES`, `META_OBJECT_ADD_METHODS`, `PAGE_META_SETTERS`, and `CONTAINER_PROPS`. The row types are imported from `@gtkx/config`, so the same schema types the JSX prop interfaces and the metadata values. `DEFAULT_PROPS` resolves each settable property's GIR default value into a TS literal, which the reconciler uses to revert a prop on removal.

## Writing the stores: transpile, symlink, atomic swap

`store-fs.ts` materializes a store as a real, resolvable installed package:

1. Each generated `.ts` / `.tsx` is transpiled in isolation to `.js` + `.d.ts` (TypeScript `transpileModule` + `transpileDeclaration`, no cross-file checking) into a fresh temp directory. Declaration emission throws on error diagnostics, so an individually-invalid module fails the whole store write rather than producing a partial result.
2. A `package.json` manifest is written with `type: module`, `sideEffects: true`, and a subpath `exports` map (one entry per namespace directory plus the JSX `metadata` entry).
3. Relative symlinks are created under the temp store's `node_modules/@gtkx/...` to the real runtime package dirs (ffi + native for `gi`; gi + react for `jsx`) and a self-link, so generated imports resolve as installed packages.
4. The temp dir is **atomically renamed** over the existing store (with a `.old` cleanup), then the visible link is repointed. The store is assembled completely before it becomes visible; a partial store never appears under the link.

The `gi` store also gets the freshness fingerprint written as a raw file inside it.

## Freshness fingerprint

`fingerprint.ts` computes a sha256 over the codegen version, the sorted library list, the serialized user tables (stably key-sorted), and the name + full contents of every GIR file in the repository. The CLI compares this fingerprint against the one stored beside the `gi` store to decide whether regeneration is needed; unchanged inputs skip the whole run. `computeFingerprint`, `serializeUserTables`, `CODEGEN_VERSION`, `FINGERPRINT_FILENAME`, and the fingerprint types are exported for that purpose.

## Khronos GL path

A self-contained, offline pipeline (`khronos/`, driven by `generateGlModules`) parses the vendored OpenGL XML registry and emits a static GL binding module. It:

1. Loads the registry and selects the command/enum subset for a target API / version / profile by resolving the `require` / `remove` closure.
2. Classifies each command parameter's C type into a `ParamPlan` (scalar, array-in, ref-out, ref-array-out, string-in/out, blob, byte-offset, …) and the return into a `ReturnPlan`.
3. Renders each command as a typed wrapper function using the same `t.*` descriptors and `t.bind`, plus derived singular helpers for the `Gen`/`Create`/`Delete` families.

Commands it cannot model (callbacks, computed/`compsize` output lengths) are excluded with a recorded reason, and a few are deferred to a hand-written companion module. The result is three modules — `types.ts`, `enums.ts`, `commands.ts` — written into the sibling `@gtkx/gl` package. Generated export names are asserted disjoint from each other and from the companion exports.
