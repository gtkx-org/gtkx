---
title: "Code Generation"
description: "How GTKX turns GIR libraries into project-specific JavaScript bindings, JSX components, metadata, and reference documentation."
---

# Code Generation

Code generation establishes the native API a GTKX project can use. It turns the project's GIR libraries into executable bindings, TypeScript declarations, React components, and reference documentation. The generated result is part of the application's dependency graph: both application code and GTKX packages import it.

The [executable-binding principle](/contributing/principles#generate-executable-bindings) requires real ESM modules whose classes and functions delegate native calls through `@gtkx/runtime`. Types and executable bindings come from the same generation step. The runtime receives the call descriptors and shapes from those modules and knows nothing about libgirepository; it does not discover signatures or construct the generated classes through runtime introspection.

The public orchestration lives in [`packages/codegen/src/runner.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/runner.ts). The CLI integrates it with project configuration in [`packages/cli/src/codegen/run-codegen.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/cli/src/codegen/run-codegen.ts). For using the command and configuring libraries, see [Configuration and Codegen](/v2/guide/configuration-and-codegen).

## Inputs and outputs

| Input | What it controls |
| --- | --- |
| Selected GIR roots | Which namespaces are bound, together with everything their GIR files include. |
| GIR search paths | Which installed or project-provided GIR files supply those namespaces. |
| GIR annotations | Types, nullability, argument directions, ownership, callback scopes, and native symbol names. |
| GTKX's element configuration | Component wrappers, additional props, omitted props, and parent-created elements. |
| Project element configuration | Project-specific additions and overrides to those element definitions. |
| Installed runtime and renderer versions | Versions recorded in the generated stores and inputs to their freshness checks. |

Adwaita's `Adw-1` is the default root. Its dependencies bring in GTK4 and the rest of the GNOME foundation. Additional configured roots extend that graph. The selection logic is in [`gir/libraries.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/gir/libraries.ts).

The main outputs are:

| Output | Contents |
| --- | --- |
| `@gtkx/gi/<namespace>` | JavaScript classes, records, interfaces, constants, functions, bootstrap code, and their `.d.ts` declarations. |
| `@gtkx/jsx/<namespace>` | React element components and prop declarations, with references to the corresponding GI classes and metadata. |
| JSX metadata and element records | Property names, flags and defaults; signal mappings; generated element configuration. |
| `.gtkx/reference` | The project's generated element reference, when reference generation is enabled. |

The stores normally live under `node_modules/.gtkx/gi` and `node_modules/.gtkx/jsx`, with package links under `node_modules/@gtkx`. They are generated packages; there are no handwritten `packages/gi` or `packages/jsx` source packages to edit.

## Parsing a library graph

[`Library.load`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/gir/library.ts) starts with the requested roots and follows their GIR includes. It first discovers namespace headers and registers namespace shells, then populates their bodies and adds declarations to shared type tables. This lets the parser resolve references across namespaces and declarations that appear later in a file.

The parsed model in `src/gir` represents classes, interfaces, records, callbacks, callable parameters, properties, enums, and container types. A `TypeId` identifies a slot within a namespace's type table. Subsequent passes resolve those identities through the `Library` instead of repeatedly interpreting XML or comparing raw type strings.

GIR annotations affect runtime correctness as well as documentation. An array's companion length parameter, a callback's user-data and destroy parameters, a nullable pointer, and a transfer-full return each change the descriptor the native bridge needs. Targeted annotation corrections live alongside the parser in files such as `nullable-overrides.ts`, `transfer-overrides.ts`, and `finish-overrides.ts`.

## Type analysis and callable shaping

The `src/analysis` modules turn the parsed model into TypeScript types and runtime descriptor expressions. Those are two views of the same native contract. A method's public signature may omit bookkeeping arguments while its native signature must retain them.

The callable pipeline accounts for these differences:

- Array lengths and callback bookkeeping can be derived or folded into the values exposed to JavaScript.
- Out parameters become returned values; a C return and multiple surfaced outputs may become a tuple.
- A trailing `GError**` becomes exception behavior while remaining an argument in the native call.
- Recognized asynchronous start/finish pairs gain promise-based wrappers.
- Records need field sizes, offsets, alignment, and ownership information in addition to their declared field types.

The mapping is implemented across [`analysis/param-structure.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/analysis/param-structure.ts), [`store/gi/param-marshal.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/gi/param-marshal.ts), [`store/gi/return-wrap.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/gi/return-wrap.ts), and [`store/gi/async.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/gi/async.ts). Descriptor construction and descriptor rendering are separate from the general TypeScript writer.

When investigating a binding, compare the GIR signature, the generated JavaScript adapter, its `.d.ts` signature, and the runtime descriptor. A declaration-only change cannot repair a native argument that is marshalled incorrectly.

## Emitting GI bindings

[`store/gi/pipeline.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/gi/pipeline.ts) emits namespace types and members. Interfaces are emitted before the classes that implement them, and classes within a namespace are ordered so their parent declarations are available. Generated class and interface registration connects their JavaScript representations to the runtime's GType registry.

Each namespace has its main binding module and a bootstrap module. The bootstrap imports dependent namespace bootstraps, applies runtime overrides, and performs required registration or retention work. The public namespace barrel imports that bootstrap. The generated package marks bootstrap, override, and index modules as side effects so bundling can preserve initialization while eliminating unused exports where possible.

Overrides under [`packages/codegen/overrides`](https://github.com/gtkx-org/gtkx/tree/main/packages/codegen/overrides) wire runtime implementations into generated types, including non-introspectable functions and upstream compatibility fixes. One catalog drives template discovery, bootstrap imports, and barrel exports. The templates contain declarations and wiring; [binding behavior belongs in runtime](/contributing/principles#keep-overrides-as-wiring). Cairo uses the external `@gtkx/cairo` namespace.

Public class declarations include the interfaces runtime installs as mixins. Signal methods inherit shared runtime types, with generated metadata describing each class's signals. Strict installed-consumer checks validate the complete declaration graph alongside actual generated imports, so workspace linking and skipped library checks cannot conceal invalid declarations.

GI methods generally defer descriptor construction and native binding through runtime factories. Native symbol lookup itself is lazy in the addon. Importing a namespace and calling one of its methods therefore have different initialization costs; see [Native Runtime](/contributing/native-runtime).

## Emitting JSX and renderer metadata

The JSX pipeline uses the same parsed library to identify element classes and derive prop and signal types. It combines those with GTKX's built-in element configuration and the project's custom configuration.

[`packages/react/src/element-config.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-config.ts) is deliberately usable without loading native bindings. It describes which props an element adds or omits, which component factory wraps it, and whether its parent creates the underlying object. Runtime attachment and update behavior lives separately in `element-behaviors.ts`.

Generated element components call the renderer's `createElementComponent` factory with the GType name, class reference, and metadata reference. Keeping those references in the component preserves the class registration and metadata needed when a production bundle removes unused code. An inherited wrapper can add application, window, or dialog lifecycle behavior.

The main sources are [`store/jsx/pipeline.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/jsx/pipeline.ts), [`store/jsx/element-components.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/jsx/element-components.ts), and [`store/jsx/metadata.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/jsx/metadata.ts). The [React Renderer](/contributing/react-renderer) page follows these outputs into a mounted tree.

## Store placement, freshness, and publication

Store placement follows package resolution. [`resolve-store.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/resolve-store.ts) finds the installed runtime and renderer, selects a `node_modules` location their consumers can reach, and keeps both generated packages together. Hoisted dependencies can therefore cause multiple workspace projects to share one store. The resolver rejects arrangements where a consumer sits above the generated packages and cannot import them.

Generation acquires store locks, prepares new output in staging directories, and publishes the prepared stores and links together. Failed preparation preserves generated sources for diagnosis. The store code also restores missing links and reclaims stale staging or generation artifacts. This machinery is in [`staging.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/staging.ts) and [`store/store-fs.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/store/store-fs.ts).

Changes to this machinery need an actual consumer requirement. [Production code must stay focused on consumers](/contributing/principles#keep-production-code-focused-on-consumers), so a quirk of GTKX's own workspace does not justify a production workaround. Likewise, existing store locks do not justify synchronization where the supported execution model has only one process handling a directory.

Freshness is content-based. The GI fingerprint covers the generator, relevant dependency versions, overrides, selected roots, search paths, store version, and GIR contents. JSX has its own fingerprint for the renderer version and element configuration; regenerating GI also invalidates JSX. Documentation fingerprints include their rendering options and element configuration. These checks are implemented in [`fingerprint.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/fingerprint.ts).

The store compiler emits JavaScript and declarations from generated TypeScript and removes successful temporary TypeScript sources. Its emission diagnostics and separate full-project checking facilities are implemented in [`compile.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/compile.ts). Successful store emission alone is not a substitute for checking the consuming project's types and exercising the resulting bindings.

## Reference documentation and OpenGL

Element reference pages reuse the GIR model, type rendering, and element prop configuration. [`docs/pipeline.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/src/docs/pipeline.ts) produces pages for URL-based website navigation or file-based project references. The CLI writes `.gtkx/reference` through [`codegen/reference.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/cli/src/codegen/reference.ts).

OpenGL bindings have a separate input pipeline under [`src/khronos`](https://github.com/gtkx-org/gtkx/tree/main/packages/codegen/src/khronos). It parses the bundled Khronos XML registry, selects and plans supported bindings, and renders modules used by `@gtkx/gl`. It shares generator infrastructure, but it does not derive OpenGL's function signatures from GIR.
