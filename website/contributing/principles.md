---
title: Development Principles
description: "GTKX's package boundaries, coding standards, testing policy, and review requirements."
---

# Development Principles

These rules apply to new and existing code. The [architecture pages](/contributing/architecture) describe the implementation; existing behavior does not establish an exception to the rules below.

## Give each layer one responsibility

| Layer | Responsibility |
| --- | --- |
| `@gtkx/native` | Memory-safe FFI, native allocations and lifetimes, and unsafe ABI operations. |
| `@gtkx/runtime` | Binding semantics, value conversion, callbacks, signals, the GObject type system, and JavaScript representations of native values. |
| `@gtkx/codegen` | Executable ESM bindings and declarations derived from GIR, using explicit runtime descriptors. |
| Codegen overrides | Wiring runtime implementations into generated modules. |
| `@gtkx/react` | Reconciliation and primitives behind generated JSX elements. |
| Components and hooks | Lifecycle effects, presentation, list factories, and other composed behavior. |

Review changes for clear ownership, observable tests, and a consumer requirement. Keep repository-specific behavior in repository tooling.

### Keep the native module minimal

Rust manages native storage, allocation lifetimes, and ABI operations. JavaScript must never need to manipulate raw pointers or perform operations that can cause undefined behavior. Binding policy belongs in the runtime; calling a C library alone does not justify putting a feature in Rust.

Omit upstream APIs that require raw pointer manipulation, or retain a throwing stub when an explicit unsupported entry point is useful. Do not expand the native layer or invent wrappers just to expose them. Keep implementation, declarations, and reference documentation consistent with that decision.

Preserve native memory safety without adding checks for states excluded by the supported type model.

### Put binding semantics in the runtime

The TypeScript runtime owns marshalling, `GValue` and `GVariant` conversion, input/output/inout handling, tuple returns, callback conventions, signals, class registration, subclassing, safe-handle wrapping, and implementations of non-introspectable functions.

Rust supplies storage and call frames; runtime defines their JavaScript contract. For example, runtime chooses which outputs become tuple members, while native code keeps their memory valid.

Runtime has no knowledge of libgirepository. Consumers supply explicit descriptors and shapes, normally through generated GI modules. Do not discover signatures or reconstruct a JavaScript API through runtime introspection.

### Generate executable bindings

Generate executable ESM classes and functions and their TypeScript declarations from the same model. Their methods call native functions through runtime. Generating only types while synthesizing JavaScript classes through libgirepository violates this boundary.

Binding construction belongs in generation and builds. GType registration for application subclasses remains a runtime operation using explicit class definitions and metadata.

### Keep overrides as wiring

Overrides attach implementations imported directly from runtime to generated exports, classes, or prototypes. Put implementations and complex logic in runtime; generated templates must not become a second binding implementation.

### Keep the reconciler transparent

Translate React host operations into native construction, prop updates, signal handlers, and child attachment, removal, and reordering. Preserve the corresponding GTK, Adwaita, and GObject semantics.

Host removal includes disconnecting the instance's handlers. Mount/unmount effects, presentation, list factories, and other abstractions belong in components and hooks. Do not introduce a separate reconciler lifecycle system or teach it application-specific behavior for new elements.

Use Adwaita for application structure and adaptive patterns, with GTK4 for lower-level primitives.

## Prefer declarative GObject creation

Create widgets and non-widget GObjects through JSX so React owns their creation, updates, relationships, and removal. There are two exceptions:

- A synchronous GTK signal needs a newly created object as an immediate return value or out parameter, before the handler returns.
- `useToast().show()` creates an ephemeral `Adw.Toast`; the overlay owns its presentation and dismissal.

Persistent models still belong in JSX. Ordinary handlers, effects, setup code, helpers, and convenient native constructors do not create further exceptions.

## Use one source of truth

Give every type, descriptor, mapping, and implementation one owner. Import or derive it elsewhere. Codegen must reuse descriptor types exposed by `@gtkx/native`; bindings, declarations, JSX props, and reference pages must share their metadata.

Fix generated behavior in its model, generator, configuration, or runtime, then regenerate. Share implementations where the contract is shared, keeping abstractions no broader than that contract requires.

## Prefer maintained dependencies over custom implementations

Prefer a maintained package over an equivalent custom implementation, including when it covers only part of the required behavior. Check existing dependencies first, then assess maintenance, compatibility, and the required contract. Keep custom code focused on GTKX integration and missing behavior.

Apply this during review too: replace existing custom implementations when a maintained dependency fits. Retain upstream workarounds until official releases contain the fix and GTKX's supported versions no longer need them.

## Prefer simple code and trust the types

Express invariants through types, constructors, ownership, and control flow. Do not use TypeScript non-null or definite-assignment assertions, or `as unknown as` casts.

Avoid checks for types or nullability already guaranteed by the model, and fallbacks, retries, synchronization, or compatibility paths for unsupported states. Supported edge cases need behavior and tests; imagined use cases and impossible typed states do not justify machinery.

Use `Rc` for Rust state confined to one thread. Do not add `Arc` for that state or a directory lockfile when the supported process model guarantees one owner.

## Keep generation metadata free of native initialization

Generation configuration and metadata must be importable without loading generated GI bindings or initializing the UI. Keep descriptions separate from native operations, as in [`element-config.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-config.ts) and [`element-behaviors.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/react/src/element-behaviors.ts). Preserve that boundary for new props, elements, and extensions.

## Respect the native UI thread

GTK objects and operations belong to the Node thread owning the GLib main context. Workers can compute and exchange plain data with it; they cannot manipulate its GTK objects.

Follow the owning-thread contract in [`runloop.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/runloop.rs) and [`handle.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/handle.rs). Cross-thread synchronization does not improve state already confined to its owner.

## Test behavior at the right level

Around 90% of the suite must be end-to-end or integration tests. Use consumer interfaces: render and interact with widgets, call generated bindings against real libraries, or build and run an installed application.

Do not add unit tests unless extremely complex logic needs exhaustive case coverage. Argue that exception explicitly; a pure function or routine helper does not qualify on that basis alone.

Test observable behavior, never private helpers, intermediate values, or implementation details. Cover happy paths, supported edge cases, and errors. For errors, assert only that the operation throws or rejects and check status codes where applicable. Do not assert message text, logs, console formatting, or cosmetic details.

### Minimize mocks

Use real implementations. Mocks are permitted only at filesystem and network boundaries, and should cover the smallest necessary surface. Do not mock the renderer, native bindings, or package internals. Use native fixtures, real widgets, isolated displays, and local services.

[Testing](/contributing/testing) lists suites and commands.

## Write self-explanatory code

Use clear names, direct control flow, and small responsibilities. Comments must not compensate for unclear code.

GTKX is GLib-first: omit the `G` prefix from our identifiers, as in `useObjectValue`. Use GTK prefixes where they clarify a name, and preserve upstream names when referencing native APIs.

Reserve comments for public API documentation and TODO/FIXME notes. Describe contracts and reasons, without narrating implementation. Each upstream workaround needs a nearby `TODO:` explaining why it exists, when it can be removed, and its GTKX tracking issue.

Public API documentation describes the current API. Discuss earlier implementations only when documenting a deprecation and its transition.

## Write focused, consistent documentation

Use concise, plain language, one idea at a time, with consistent terminology and structure. Give readers the context they need without repeating it across pages.

Guides and tutorials explain GTKX concepts and tasks with small examples. Link to API reference for specifications, type definitions, and exhaustive member lists.

Assume familiarity with the underlying languages and libraries; link to their official documentation for background. Explain GTKX's integration with React, GTK, and Adwaita without reteaching those projects.

Use **The React framework for Linux** as the slogan. GTKX is the product name. Mention GNOME and Adwaita in subtitles or when explaining the underlying technology.

## Keep production code focused on consumers

Production behavior must serve consumers. Keep workspace layout, linking, cache, test, and build-orchestration fixes in repository configuration, scripts, fixtures, or the environment. Do not add production resolution fallbacks, path special cases, or concurrency mechanisms just to accommodate this checkout.

Validate behavior in an ordinary consumer project. The [consumer and packaging checks](/contributing/testing#consumer-and-packaging-checks) exercise installed packages outside workspace imports.
