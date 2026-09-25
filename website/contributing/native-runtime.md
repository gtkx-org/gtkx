---
title: "Native Runtime"
description: "GTKX's TypeScript runtime, Rust FFI bridge, native ownership model, callback handling, and GLib integration."
---

# Native Runtime

GTKX's native runtime spans two packages. `@gtkx/runtime` implements JavaScript-facing binding behavior in TypeScript. `@gtkx/native` is a Rust addon that handles the ABI, pointers, native memory, and integration with Node. Generated GI code supplies the signatures and metadata that connect them.

The required boundary keeps [`@gtkx/native` minimal](/contributing/principles#keep-the-native-module-minimal): it supplies memory-safe FFI operations without exposing raw pointers or undefined behavior to JavaScript. [Binding semantics belong to `@gtkx/runtime`](/contributing/principles#put-binding-semantics-in-the-runtime), including marshalling, GValue and GVariant conversion, callback conventions, signal handling, and the GObject type system.

The Rust crate builds a Node addon through napi-rs and uses libffi for native calls, libloading for shared libraries, and the Rust GLib bindings for GLib and GObject operations. Its dependencies and supported addon targets are declared in [`packages/native/Cargo.toml`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/Cargo.toml) and [`packages/native/package.json`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/package.json).

## From a JavaScript method to a C call

The central contract is a descriptor: a structured description of a value's native representation and how it crosses the boundary. Descriptors distinguish scalars, strings, objects, boxed values, records, arrays, hash tables, callbacks, and references. They also carry details such as ownership, element layout, and native type names.

A call passes through these stages:

1. A generated adapter presents the public JavaScript signature and supplies a runtime function specification.
2. [`runtime/src/fn.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/fn.ts) plans inputs and outputs and wraps callbacks. Shared runtime conversion plans encode strings as UTF-8 bytes, normalize Number inputs for bigint values, and lower booleans, Unicode characters, enums, and flags to their ABI representations.
3. [`native/src/api/bind.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/bind.rs) turns descriptors into codecs and a libffi call interface. It records the target symbol, vtable slot, or function pointer.
4. [`native/src/api/call.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/call.rs) prepares native storage, invokes the target, and returns the result and output values while settling ownership transfers.
5. The TypeScript runtime converts returned values, updates JavaScript references, reports errors, and packs surfaced outputs into the public return shape.

The two main reusable pieces are the compiled call interface and the resolved symbol. A lazy runtime function specification defers creating the bound callable until its first invocation. The native call descriptor then caches its resolved target. Shared-library loading and symbol lookup are centralized in [`ffi/library_cache.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/library_cache.rs).

The current native call also checks argument counts, and object codecs check declared native types when those types can be resolved. Review these checks against [the principle of trusting the types](/contributing/principles#prefer-simple-code-and-trust-the-types): safe native memory access is required, while redundant validation of statically guaranteed values and unsupported cases should not be added.

## Values, temporary storage, and ownership

The runtime's shared conversion plans serve calls, fields, callbacks, references, and collections. They normalize scalar and collection inputs, encode and decode strings, and choose their public JavaScript representations. The native [`ffi/codec`](https://github.com/gtkx-org/gtkx/tree/main/packages/native/src/ffi/codec) modules pack those normalized values into ABI storage and C or GLib containers, retaining responsibility for bounds, terminators, traversal, allocation, and ownership. A `Stash` holds an invocation's temporary allocations, callback state, and pending ownership transfers.

Ownership is directional. Passing a borrowed value to C differs from handing ownership to C; receiving a borrowed pointer differs from receiving a newly owned allocation. A container's allocation and its elements can also have distinct transfer requirements. The generated descriptor supplies those rules, and the relevant codec acquires, copies, transfers, or releases memory accordingly.

Pending transfers are committed after the native call. Until then, temporary storage can release allocations if preparation fails. For asynchronous calls, runtime identifies the completion callback and the addon retains the required argument storage and owners until completion. A temporary buffer cannot escape without a lifetime that safely covers its use.

This logic is especially relevant when changing byte arrays, string arrays, callback scopes, or inout parameters. The sources are [`ffi/stash.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/stash.rs), [`ffi/stash/storage.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/stash/storage.rs), and the asynchronous retention path in `api/call.rs`.

## Handles and wrapper identity

JavaScript wrappers hold native handles through the TypeScript runtime's registry. [`runtime/src/registry.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/registry.ts) maps GTypes to wrapper classes, resolves the nearest registered ancestor for native types, composes interface behavior, and associates JavaScript instances with handles.

A handle is a Rust object exposed through Node's external-value mechanism. [`native/src/handle.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/handle.rs) distinguishes several underlying lifetimes:

| Handle kind | Lifetime behavior |
| --- | --- |
| GObject | Holds or borrows a GObject reference and participates in wrapper tracking. |
| Boxed value | Uses the boxed type's copy and free behavior, or the supplied operations. |
| Fundamental value | Uses native reference and release functions for a non-GObject reference-counted type. |
| Owned record | Owns an allocation released through its free function or GLib's allocator. |
| Borrowed pointer | Refers to memory owned elsewhere, with an explicitly limited or process-wide lifetime. |
| Field view | Aliases an offset inside another handle and keeps that owner reachable. |

Tracked GObjects reuse an existing JavaScript wrapper when one is available. This matters for identity, JavaScript state attached to subclasses, and signal handlers. The native implementation stores wrapper information on the GObject and uses toggle references to coordinate native reference counts with the strength of Node's reference to the wrapper. Native ownership keeps the wrapper reachable; when the toggle reference is the remaining native reference, the JavaScript wrapper can become collectible.

Wrapper finalization schedules cleanup through the GLib context, including removal of the toggle reference. The implementation also tracks replacement generations so cleanup for an older wrapper cannot remove a newer association. See [`value/wrapper.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/value/wrapper.rs) and [`ffi/codec/object.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/codec/object.rs).

Some callback arguments borrow memory valid only for the current invocation. A borrow scope records their handles; leaving the invocation invalidates those handles, including on an error path. Field views inherit their owner's invalidation. Holding the JavaScript wrapper after that point does not extend the native borrow.

Executable targets also use opaque handles. Library symbols remain available with their library, call-scoped callbacks expire when their enclosing call ends, and one-shot callback handles expire before invocation. The runtime passes those handles directly to the native binding API.

## Callbacks and signals

Callbacks reverse the FFI direction. A libffi closure supplies the C entry point, and the addon keeps callback state alive during each invocation. Runtime converts incoming values, invokes the JavaScript handler and prepares its return and output values. The addon reads and writes the corresponding ABI storage.

[`ffi/closure.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/closure.rs) tracks callback invocations in flight and defers destruction when cleanup is requested from inside a callback. One-shot completion callbacks, destroy notifications, and callbacks with no release mechanism have different retention paths. The lifetime of a callback is therefore part of the native signature, not something JavaScript garbage collection can infer by itself.

GObject signals use the runtime's [`signal.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/signal.ts), [`closure.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/closure.ts), and [`listeners.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/listeners.ts). These handle signal lookup, connection and disconnection, and closure marshalling. The React renderer builds signal props on top of that API.

Promise wrappers for GIO-style operations remain a separate layer. [`promisify.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/promisify.ts) invokes the start function, receives its asynchronous result, calls the finish function, and resolves or rejects the promise. Native asynchronous storage retention still has to be correct underneath that promise. See [Async Operations](/v2/guide/async-operations) for the public behavior.

## Registering native subclasses

`registerClass` creates a native GType for a JavaScript subclass and installs the properties, signals, interfaces, and virtual-function overrides it declares. Generated metadata identifies vtable slots and their signatures. The runtime bridges an override to a native callback and provides calls back into parent implementations.

[`runtime/src/register-class.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/register-class.ts) owns signal rules, interface ordering, property overrides, class flags, and CSS naming. The runtime's `vfunc` modules supply the callback conventions; [`native/src/api/register_class.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/register_class.rs) retains class allocation and callback lifetime mechanics. A JavaScript class hierarchy alone does not register a GType. The [Subclassing guide](/v2/guide/subclassing) describes the application API.

## GLib inside Node's event loop

Importing the public native package runs its bootstrap and initializes the native environment. [`runloop.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/runloop.rs) acquires GLib's default main context on that Node thread and connects it to the thread's libuv loop.

The integration uses three kinds of libuv handle:

| Handle | Purpose |
| --- | --- |
| Prepare | Dispatch ready GLib work without blocking before libuv waits. |
| Poll | Wake libuv when file descriptors requested by GLib become ready. |
| Timer | Wake libuv for GLib timeouts or immediately ready sources. |

Each prepare callback iterates the GLib context without blocking, stopping when there is no work or the current four-millisecond dispatch budget expires. It then queries GLib's next deadline and descriptors, updates poll handles, and arms the timer. The budget limits a batch of iterations; it cannot interrupt a long-running callback. Native dispatch runs within Node callback scopes so JavaScript callbacks and microtasks participate in Node's execution model.

The handles are normally unreferenced, so merely importing GTKX does not keep an otherwise idle Node process alive. Application activation requests a keep-alive reference; shutdown releases it. Environment cleanup releases the event-loop integration and its dispatch resources.

Only the owning thread can operate this GTKX runtime. Attempting to acquire the context from another thread while it is owned fails. Worker communication should carry plain data back to the owner; native objects and GTK operations stay there.

A standalone worker can initialize GTKX when no other thread has done so. Before terminating an owning worker, finish native operations or cancel them and await completion. Disconnect signal handlers and remove other native callback registrations, then call `quit()` from `@gtkx/runtime`. The worker must report cleanup completion before its parent calls `worker.terminate()`. `quit()` does not cancel operations or await their callbacks. Terminating a worker with live native operations or registrations is unsupported.

## Application lifecycle and errors

[`runtime/src/lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/lifecycle.ts) starts GTKX-created applications through GLib's local command-line handling. That preserves GLib option parsing, registration, activation, and forwarding to an existing application instance while keeping Node as the outer loop.

The runtime records whether an application is primary, remote, unregistered, or shut down. React waits for activation before mounting application children, avoiding window creation in a remote process. On teardown, GTKX detaches application windows and reaches GLib's shutdown path through an adapted `g_application_run()` call once it can complete without owning the normal application loop. It also releases the process-wide default application association.

Runtime shutdown runs registered exit callbacks and releases native keep-alive before propagating cleanup errors. A failing callback cannot prevent the remaining cleanup, and repeated or reentrant shutdown does not run it twice.

Errors need to cross the same boundaries as successful results. Throwing native functions report `GError` through an out parameter that the TypeScript runtime turns into an exception. Runtime converts callback exceptions into owned `GError` values when the signature supplies an error slot. Native retains error-slot ABI metadata, validates and copies the supplied handle, and preserves the original exception when the error slot is absent or occupied. The direct addon transport is `CallbackFailure` in [`native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts). GLib criticals raised during a bound call are collected and reported after the call returns, and Rust entry points guard unwinding at FFI boundaries.

The relevant sources are [`runtime/src/error.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/error.ts), [`native/src/host/log_writer.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/log_writer.rs), and [`native/src/host/panic_handler.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/panic_handler.rs). The [Error Handling guide](/v2/guide/error-handling) explains which errors an application's React boundaries can catch and which occur outside rendering.
