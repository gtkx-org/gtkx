---
title: Development Principles
description: "GTKX's required package boundaries, simplicity rules, testing strategy, and standards for reviewing the codebase."
---

# Development Principles

These principles define how GTKX should be built. They guide implementation decisions, code review, and the systematic review of the codebase for GTKX 2.0. Existing code is subject to these rules; its presence does not establish an exception.

The [architecture pages](/contributing/architecture) describe the current implementation and point to its source. Where that implementation differs from the boundaries below, these principles define the required direction.

## Give each layer one responsibility

| Layer | Responsibility |
| --- | --- |
| `@gtkx/native` | A minimal, memory-safe FFI boundary that owns native memory and unsafe ABI operations. |
| `@gtkx/runtime` | Binding semantics, value conversion, callbacks, signals, the GLib/GObject type system, and the JavaScript representation of native values. |
| `@gtkx/codegen` | Convert GIR into executable ESM bindings and declarations that use the runtime with explicit descriptors. |
| Codegen overrides | Attach runtime implementations to generated modules. |
| `@gtkx/react` | The reconciler and primitives used by generated JSX elements, with component and hook behavior kept above reconciliation. |
| Higher-level components | Lifecycle effects, list factories, and other composed behavior built on those primitives. |

### Keep the native module minimal

`@gtkx/native` should be as lean as possible. Its purpose is to provide a safe FFI layer: manage native allocations and ownership, enforce native memory lifetimes, and perform the ABI operations that require access to native memory. JavaScript must never need to manipulate raw pointers or perform operations that can cause undefined behavior.

Keep only the native mechanics necessary to uphold that contract in Rust. Binding policy and the meaning of values belong in `@gtkx/runtime`. A feature does not belong in Rust merely because the library it calls is written in C.

Native memory safety is the contract of this layer. Redundant checks for states ruled out by the supported type model do not belong here or elsewhere in the framework.

### Put binding semantics in the runtime

`@gtkx/runtime` owns everything above the safe FFI boundary. This includes:

- Marshalling between JavaScript values and the representations consumed by FFI operations.
- `GValue` and `GVariant` packing and unpacking.
- Input, output, and inout parameter handling, including conversion of returned values into tuples.
- Callback and closure calling conventions and their JavaScript behavior.
- Signal connection, invocation, and disconnection.
- The GLib/GObject class and type system, class registration, and subclass creation.
- Wrapping and unwrapping safe native handles as JavaScript objects.
- Implementations of non-introspectable GIR functions.

Rust supplies safe operations on native storage and call frames. The runtime decides how those operations implement a binding's JavaScript contract. For example, deciding which output parameters become tuple members belongs in the runtime; keeping the memory behind those parameters valid belongs in the native layer.

The runtime has no knowledge of libgirepository. Consumers supply call descriptors and shapes explicitly, normally through generated `@gtkx/gi/*` modules. The runtime must not discover a binding's signature or reconstruct its JavaScript API from a runtime introspection repository.

### Generate executable bindings

`@gtkx/codegen` converts GIR files into real ESM modules that use `@gtkx/runtime` with the appropriate descriptors. The generated module contains the classes, functions, and exports an application imports. Its methods delegate to native functions through the runtime.

Generate the executable binding and its TypeScript declaration from the same model. The types and the calls they describe must share a source of truth. Generating types while separately synthesizing JavaScript classes through libgirepository at runtime violates this architecture.

Binding construction belongs in generation and build steps. Native GType registration for application-defined subclasses remains a runtime responsibility; it uses the explicit class definitions and metadata supplied to the runtime.

### Keep overrides as wiring

Codegen overrides monkeypatch generated modules with implementations imported directly from `@gtkx/runtime`, primarily for functions GIR cannot describe. An override should only attach those implementations to the appropriate exports, classes, or prototypes.

Overrides must not contain their own implementations or complex logic. Move that behavior into the runtime, then reference it from the override. Generated templates must not become a second implementation layer for binding behavior.

### Keep the reconciler transparent

`@gtkx/react` supports generated `@gtkx/jsx/*` modules in the same way that `@gtkx/runtime` supports generated `@gtkx/gi/*` modules: each supplies the implementation primitives behind a generated public surface.

The reconciler should be a thin translation of React host operations into native operations. It constructs host instances, applies props and signal handlers, and appends, removes, or reorders children using the corresponding GTK, Adwaita, or GObject APIs. Preserve the native APIs' semantics.

Mount and unmount effects, presentation flows, list-factory handling, and other complex abstractions belong in components and hooks above the reconciler. Removing children and disconnecting the host instance's own handlers are part of reconciliation; introducing a separate lifecycle system inside it is not.

Adding a new native element should use these primitives. It must not require teaching the reconciler application-specific behavior or creating a framework API that diverges from the native platform. Use Adwaita for application structure and adaptive patterns, with GTK4 for the underlying primitives.

## Prefer declarative GObject creation

Application and component code should instantiate GObjects through JSX. This applies to non-widget GObjects as well as visible widgets. Express their relationships in the declarative tree so React controls their creation, updates, and removal.

The exception is a synchronous GTK signal that requires a newly created GObject as an immediate return value or out parameter. That operation occurs outside the React render cycle and must provide the object before the signal handler returns.

Ordinary event handlers, effects, setup code, and helper functions do not broaden that exception. Convenience or the existence of a native constructor is not a reason to create objects imperatively.

## Use one source of truth

Enforce a single source of truth and avoid duplication throughout the codebase. Each type, descriptor, mapping, and implementation should have a clear owner. Consumers should import or derive what they need from that owner.

For example, codegen must reuse descriptor types already exposed by `@gtkx/native`. It must not redeclare equivalent types and rely on contributors to keep them synchronized. The same rule applies to the metadata shared by executable bindings, declarations, JSX prop types, and generated reference pages.

Correct generated behavior in its source model, generator, configuration, or runtime implementation, then regenerate. A manual edit to generated output does not repair its source of truth.

Share an implementation when its contract is shared. Keep the resulting abstraction as small as that contract requires; speculative generality makes the code harder to understand without removing a real duplication.

## Prefer maintained dependencies over custom implementations

Strive for the least amount of hand-written code. When a well-maintained third-party package implements the behavior we need, or a useful part of it, prefer that package over building and maintaining an equivalent implementation ourselves.

Check the dependencies already in use before adding another one. Evaluate maintenance, compatibility, and the supported contract before choosing a package; an abandoned or unsuitable dependency does not satisfy this principle. Keep GTKX-specific code focused on the integration and behavior the dependency does not provide.

Apply this rule during reviews as well as when adding features. Existing custom implementations should be replaced when a maintained dependency fits their contract. Familiarity with the current code is not a reason to preserve duplication.

## Prefer simple code and trust the types

Use the simplest implementation that satisfies the supported contract. Trust the type system completely. Express invariants through types, constructors, ownership, and control flow, then use them directly.

Do not add defensive programming for unsupported or impossible states. Avoid runtime type checks and null checks when the types already establish the value's type and presence. Do not introduce fallbacks, retries, synchronization, or compatibility branches for situations the framework does not support.

Use `Rc` for Rust state that stays on one thread. `Arc` adds an unnecessary concurrency mechanism when ownership and mutation are always confined to that thread. Likewise, do not add a directory lockfile when the supported process model already guarantees that a single process owns the directory.

Do not bypass the type model with TypeScript non-null or definite-assignment assertions, or casts through `as unknown as`. Model the invariant correctly instead. Repeating a check at each use site and asserting the invariant away both leave the underlying model unresolved.

A supported edge case can require behavior and tests. An imagined use case, an impossible typed state, or an unsupported execution model cannot justify extra production machinery.

## Keep generation metadata free of native initialization

Configuration and metadata consumed during generation must remain importable without loading generated GI bindings or initializing the native UI. Keep declarative descriptions separate from the code that performs native operations.

The existing separation between [`element-config.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-config.ts) and [`element-behaviors.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-behaviors.ts) establishes this boundary. Preserve it when adding props, element definitions, or configuration extensions.

## Respect the native UI thread

GTK objects and their native operations belong to the Node thread that owns the GLib main context. Worker threads can perform computation and exchange plain data with that owner. They do not provide additional threads for manipulating GTK objects.

Keep state and ownership consistent with that execution model. The [main-loop integration](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/runloop.rs) and [native handles](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/handle.rs) establish the owning-thread contract; adding cross-thread synchronization to otherwise thread-confined state does not improve it.

## Test behavior at the right level

Integration and acceptance tests are the default. Drive the feature through the interface a consumer uses: render and interact with widgets, invoke generated bindings against real native libraries, or build and run a consumer application. Around 90% of the suite should exercise behavior at these levels.

Pure modules with complex, high-value logic should receive unit tests where exhaustive case coverage provides meaningful value. Justify that choice explicitly. Purity alone is not enough, and the exception does not make routine helpers worth unit testing.

At every level, assert the subject's observable contract. Do not test private helpers, intermediate values, or implementation details. A test should remain valid when the implementation changes while its contract stays the same.

Cover the happy path, supported edge cases, and error paths. For error paths, assert that an operation throws or rejects, and check status codes where applicable. Do not assert error message text, logs, console formatting, or other cosmetic details.

### Minimize mocks

Use real implementations wherever possible. Mocks are limited to filesystem or network operations and operations whose cost makes them impractical for the relevant test. An operation must be meaningfully slow to justify that exception; needing more setup does not make it slow.

Keep any mock at the smallest necessary boundary. Mocking the renderer, native binding behavior, or another package's internals removes the integration the test should exercise. Native fixtures, real widgets, isolated displays, and local services let tests exercise the actual contracts.

See [Testing](/contributing/testing) for the existing suites and commands.

## Write self-explanatory code

Use clear names, direct control flow, and small, well-defined responsibilities so the implementation explains itself. Comments must not compensate for code that is difficult to follow.

GTKX is GLib-first, so omit the `G` prefix from our own identifiers: use `useObjectValue`, for example. GTK prefixes are welcome when they make a name clearer. Preserve upstream names when referencing native APIs.

Reserve code comments for public API documentation. Explain why an API or constraint exists and what consumers need to understand about its contract. Do not narrate what the code already does.

Comments must describe the current API without recounting earlier implementations. Deprecation documentation is the exception, where the transition is part of the public contract.

## Write focused, consistent documentation

Write in a human, concise style that is easy to follow. Use plain language, explain one idea at a time, and keep terminology and page structure consistent within each section. Include the context a reader needs to use GTKX without repeating it across pages.

Guides and tutorials explain GTKX concepts and workflows. Use small examples that support the task; leave complete API specifications, type definitions, and exhaustive member lists to the API reference. Link to the reference when readers need those details.

Keep the scope on GTKX. Assume readers know the underlying languages and libraries, and link to their official documentation when background is needed. For example, show how React state drives a GTKX widget without teaching React state itself. Explain GTKX's integration with React, GTK, and Adwaita; let those projects document their own behavior.

## Keep production code focused on consumers

Production code serves real consumers of the framework. It must not contain special behavior solely to accommodate this repository's workspace layout, package linking, caches, test setup, or build orchestration.

Resolve monorepo quirks in repository configuration, development scripts, fixtures, or the environment that runs them. A workaround for the GTKX checkout is not a production feature. In particular, do not add package-resolution fallbacks, path special cases, or concurrency mechanisms solely because the monorepo makes them convenient.

Validate production behavior in an ordinary consumer project. The repository's [consumer and packaging checks](/contributing/testing#consumer-and-packaging-checks) exercise installed packages outside workspace imports and help distinguish framework requirements from repository-specific problems.
