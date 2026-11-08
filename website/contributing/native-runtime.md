---
title: "Native Runtime"
description: "GTKX's TypeScript runtime, Rust FFI bridge, native ownership model, callback handling, and GLib integration."
---

# Native Runtime

`@gtkx/runtime` implements JavaScript binding behavior. The Rust addon, `@gtkx/native`, handles ABI operations, native memory, and Node integration. Generated GI code supplies their signatures and metadata; JavaScript accesses native memory through checked handles.

TypeScript describes ABI layouts, inspects fields through checked handles, prepares arguments, selects native functions, and implements library behavior. The addon uses transfer annotations and copy/ref/free operations to acquire, retain, transfer, and release native memory. JavaScript supplies those rules without manually balancing references.

Handles normally become eligible for native cleanup through JavaScript garbage collection. Native code owns temporary allocations, active-call leases, callback trampolines, and dependencies that must survive wrapper collection. Application operations such as closing a window, completing a stream, or finishing a Cairo surface remain available because they change library behavior independently of handle collection.

The Rust crate builds a Node addon through napi-rs and uses libffi for native calls, libloading for shared libraries, and the Rust GLib bindings for GLib and GObject operations. Its dependencies and supported addon targets are declared in [`packages/native/Cargo.toml`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/Cargo.toml) and [`packages/native/package.json`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/package.json).

## From a JavaScript method to a C call

A descriptor specifies a value's native representation and how it crosses the boundary. Descriptors distinguish scalars, strings, objects, boxed values, records, arrays, hash tables, callbacks, and references. They also carry details such as ownership, element layout, and native type names.

A call passes through these stages:

1. A generated adapter presents the public JavaScript signature and supplies a runtime function specification.
2. [`runtime/src/fn.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/fn.ts) plans inputs and outputs and wraps callbacks. Shared runtime conversion plans validate public numbers, encode strings as UTF-8 bytes, normalize reference cells, and lower booleans, Unicode characters, enums, and flags to their ABI representations.
3. Native `compileDescriptor` prepares reusable value codecs. [`native/src/api/bind.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/bind.rs) combines those compiled descriptors with the argument layout to prepare a libffi call interface. Runtime resolves and caches the symbol or vtable slot lazily, then passes its executable handle alongside the compiled signature.
4. [`native/src/api/call.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/call.rs) accepts normalized arguments or requests them one at a time from a runtime producer (see [Non-scalar reference storage](/contributing/native-ownership#non-scalar-reference-storage)), then prepares native storage, invokes the target, and returns the result and output values while settling ownership transfers.
5. The TypeScript runtime converts returned values, updates JavaScript references, reports errors, and combines output values into the public return shape.

Compiled value descriptors, function signatures, and executable targets have independent lifetimes and can be reused. A lazy runtime function specification defers creating the bound callable until its first invocation. [Library handles, lifecycle resolution, and binding targets](/contributing/native-ownership#library-handles-lifecycle-resolution-and-binding-targets) describes how targets are found.

`compileDescriptor` snapshots descriptor metadata into an owned native codec. Field reads and writes, pointer values, and function binding consume compiled descriptors, so repeated use avoids descriptor parsing. Function descriptors and vfunc registration consume compiled signatures, which retain their codecs independently of the JavaScript descriptor handles. The runtime allocates scalar output storage by its ABI width. Native calls check argument counts, and object codecs check declared native types when those types can be resolved.

Runtime also expands callback user-data and destroy-notify arguments, assigns their native positions, and calculates the expanded fixed-argument count for variadic calls. Reordering works within the fixed or the variadic region but cannot move an argument across the boundary between them. Native compilation validates the supplied permutation against the actual ABI argument count before building the call interface.

## Values, temporary storage, and ownership

The runtime's shared conversion plans serve calls, fields, callbacks, references, and collections. They normalize scalar and collection inputs, encode and decode strings, and choose their public JavaScript representations. The native [`ffi/codec`](https://github.com/gtkx-org/gtkx/tree/main/packages/native/src/ffi/codec) modules pack those normalized values into ABI storage and C or GLib containers, retaining responsibility for bounds, terminators, traversal, allocation, and ownership. A `Stash` holds an invocation's temporary allocations, callback state, and pending ownership transfers.

Ownership is directional. Passing a borrowed value to C differs from handing ownership to C; receiving a borrowed pointer differs from receiving a newly owned allocation. A container's allocation and its elements can also have distinct transfer requirements. The generated descriptor supplies those rules, and the relevant codec acquires, copies, transfers, or releases memory accordingly.

Pending transfers are committed after the native call. Until then, temporary storage can release allocations if preparation fails. For asynchronous calls, runtime recognizes the GIO completion-callback signature and the addon retains the required argument storage and owners until completion. Runtime identifies completion callbacks heuristically; native code validates the selected callback and manages the retained memory.

This logic is especially relevant when changing byte arrays, string arrays, callback scopes, or inout parameters. The sources are [`ffi/stash.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/stash.rs), [`ffi/stash/storage.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/stash/storage.rs), and the asynchronous retention path in `api/call.rs`.

## Handles and wrapper identity

JavaScript wrappers hold native handles through the TypeScript runtime's registry. [`runtime/src/registry.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/registry.ts) maps GTypes to wrapper classes, resolves the nearest registered ancestor for native types, composes interface behavior, and associates JavaScript instances with handles.

A handle is a Rust object exposed through Node's external-value mechanism. [`native/src/handle.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/handle.rs) distinguishes several underlying lifetimes:

| Handle kind       | Lifetime behavior                                                                      |
| ----------------- | -------------------------------------------------------------------------------------- |
| GObject           | Holds or borrows a GObject reference and participates in wrapper tracking.             |
| Boxed value       | Uses the boxed type's copy and free behavior, or the supplied operations.              |
| Fundamental value | Uses native reference and release functions for a non-GObject reference-counted type.  |
| Owned record      | Owns an allocation released through its free function or GLib's allocator.             |
| Borrowed pointer  | Refers to memory owned elsewhere, with an explicitly limited or process-wide lifetime. |
| Field view        | Aliases an offset inside another handle and keeps that owner reachable.                |

Tracked GObjects reuse an existing JavaScript wrapper when one is available. This matters for identity, JavaScript state attached to subclasses, and signal handlers. The native implementation stores wrapper information on the GObject and uses toggle references to coordinate native reference counts with the strength of Node's reference to the wrapper. Native ownership keeps the wrapper reachable; when the toggle reference is the remaining native reference, the JavaScript wrapper can become collectible.

Wrapper finalization schedules cleanup through the GLib context, including removal of the toggle reference. The implementation also tracks replacement generations so cleanup for an older wrapper cannot remove a newer association. See [`value/wrapper.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/value/wrapper.rs) and [`ffi/codec/object.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/codec/object.rs).

Fundamental wrappers use a separate runtime weak cache. Native supplies a live instance identity and whether the handle owns a reference. Only owned handles populate the cache; valid borrowed handles can find an existing owner. Cache lookup checks the wrapper's current handle, handle replacement removes its old registration, and finalizer tokens prevent delayed cleanup from deleting a newer entry. Native still controls reference acquisition, release, and borrow invalidation.

Some callback arguments borrow memory valid only for the current invocation. A borrow scope records their handles; leaving the invocation invalidates those handles, including on an error path. Field views inherit their owner's invalidation. Holding the JavaScript wrapper after that point does not extend the native borrow.

An API that frees a value before collection, such as Cairo's `Context[Symbol.dispose]()`, goes through `releaseHandle`. Native frees an owned boxed value at once, or ends a borrow early, and later uses of the handle and its field views throw. A value that a running call or a pending asynchronous operation holds a lease on is refused, so C never sees freed memory.

Generated accessors read a record or union embedded by value in another record as a field view, as GJS does for nested boxed values. The view keeps its parent's handle, and therefore its memory, alive. When the embedded record holds pointers, the generated field has no setter: copying the record would alias pointers its parent owns.

Executable targets also use opaque handles. Library symbols remain available with their library, call-scoped callbacks expire when their enclosing call ends, and one-shot callback handles expire before invocation. The runtime passes those handles directly to the native binding API.

## Callbacks and signals

Callbacks reverse the FFI direction. A libffi closure supplies the C entry point, and the addon keeps callback state alive during each invocation. Runtime converts incoming values, invokes the JavaScript handler and prepares its return and output values. The addon reads and writes the corresponding ABI storage.

[`ffi/closure.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/closure.rs) tracks callback invocations in flight and defers destruction when cleanup is requested from inside a callback. One-shot completion callbacks, destroy notifications, and callbacks with no release mechanism have different retention paths. The native signature must specify the callback lifetime so the addon can retain it for the required scope.

GObject signals use the runtime's [`signal.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/signal.ts), [`closure.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/closure.ts), and [`listeners.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/listeners.ts). These handle signal lookup, connection and disconnection, and JavaScript value marshalling. Native `createFunction` accepts a compiled signature and a pointer or closure descriptor. Its closure form allocates and sinks the `GClosure`, installs its marshal, and releases the callback trampoline when the closure is finalized. Runtime finalization callbacks only retire JavaScript connection bookkeeping. The React renderer builds signal props on top of that API.

Promise wrappers for GIO-style operations remain a separate layer. [`promisify.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/promisify.ts) invokes the start function, receives its asynchronous result, calls the finish function, and resolves or rejects the promise. Promise completion and native argument-storage retention are managed separately. See [Async Operations](/v2/guide/async-operations) for the public behavior.

## Registering native subclasses

`registerClass` creates a native GType for a JavaScript subclass and installs the properties, signals, interfaces, and virtual-function overrides it declares. Generated metadata identifies vtable slots and their signatures. Runtime supplies each override's compiled `bindFunction` signature, slot offset, and handler. Native validates callback compatibility and retains the signature and callback through the registered type's lifetime. The runtime also provides calls back into parent implementations.

[`runtime/src/register-class.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/register-class.ts) owns signal rules, interface ordering, property overrides, class flags, and CSS naming. The runtime's `vfunc` modules supply the callback conventions; [`native/src/api/register_class.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/register_class.rs) retains class allocation and callback lifetime mechanics. A JavaScript class hierarchy alone does not register a GType. The [Subclassing guide](/v2/guide/subclassing) describes the application API.

## GLib inside Node's event loop

Importing the runtime initializes the native addon through [`runtime/src/native.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/native.ts) before runtime modules create bindings. Importing the addon alone does not acquire a GLib context. [`runloop.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/runloop.rs) acquires GLib's default main context on that Node thread and connects it to the thread's libuv loop.

The integration uses these libuv handles:

| Handle  | Purpose                                                          |
| ------- | ---------------------------------------------------------------- |
| Prepare | Dispatch ready GLib work without blocking before libuv waits.    |
| Poll    | Wake libuv when file descriptors requested by GLib become ready. |
| Timer   | Wake libuv for GLib timeouts or immediately ready sources.       |

Runtime supplies a four-millisecond dispatch budget during initialization. Each prepare callback iterates the GLib context without blocking, stopping when there is no work or that budget expires. It then queries GLib's next deadline and descriptors, updates poll handles, and arms the timer. The budget limits a batch of iterations; it cannot interrupt a long-running callback. Native dispatch runs within Node callback scopes so JavaScript callbacks and microtasks participate in Node's execution model.

The handles are unreferenced, so merely importing GTKX does not keep an otherwise idle Node process alive. Application activation calls runtime `keepAlive`, which holds a Node timer; shutdown clears it. This controls event-loop liveness independently of application-object retention. The timer belongs to its JavaScript environment, and environment cleanup releases the native event-loop integration and its dispatch resources.

Only the owning thread can operate this GTKX runtime. Attempting to acquire the context from another thread while it is owned fails. Worker communication should carry plain data back to the owner; native objects and GTK operations stay there.

A standalone worker can initialize GTKX when no other thread has done so. Before terminating an owning worker, finish native operations or cancel them and await completion. Disconnect signal handlers and remove other native callback registrations, then call `quit()` from `@gtkx/runtime`. The worker must report cleanup completion before its parent calls `worker.terminate()`. `quit()` does not cancel operations or await their callbacks. Terminating a worker with live native operations or registrations is unsupported.

## Application lifecycle and errors

The [GIO application override](https://github.com/gtkx-org/gtkx/blob/main/packages/codegen/overrides/gio/overrides/application.ts) implements `Application.runAsync(argv)` through GLib's local command-line handling. That preserves GLib option parsing, registration, activation, and forwarding to an existing application instance while keeping Node as the outer loop.

The override tracks application runs, windows, explicit JavaScript holds, inactivity deadlines, and shutdown. React waits for activation before mounting application children, avoiding window creation in a remote process. On teardown, GTKX detaches application windows and reaches GLib's shutdown path through an adapted `g_application_run()` call once it can complete without owning the normal application loop. It also releases the process-wide default application association.

Process shutdown in [`runtime/src/lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/lifecycle.ts) runs registered exit callbacks, clears and disables its keep-alive timer, and tears down native integration before propagating cleanup errors. Native `quit` first runs pending cleanup, drops the object references that handles only JavaScript holds still keep (an owned object handle awaiting collection, a `GObject.Value`), and gives up the wrappers' toggle references while JavaScript can still run, so teardown can still call JavaScript vfuncs and signal handlers. Objects native code still references keep their wrappers, strongly held so their JavaScript state outlives disposal, but lose the toggle references, so each is disposed when its native owners let it go, as in C. Objects only their wrappers reference are then released, repeating as disposal leaves more of them: widgets first, then instances of registered classes, each in wrapping order, so teardown that calls back into JavaScript still finds the objects its JavaScript state holds, then other objects, newest first, so an object goes before the one it came from. A wrapper stays installed while its object is disposed, and a later wrapper for a surviving object starts afresh. Surfaces and objects in a wrapper borrow keep their toggle references for environment teardown, where callbacks are already retired. A failing callback cannot prevent the remaining cleanup, and repeated or reentrant shutdown does not run it twice.

Throwing native functions report `GError` through an out parameter that the TypeScript runtime turns into an exception. Runtime converts callback exceptions into owned `GError` values when the signature supplies an error slot. Native retains error-slot ABI metadata, validates and copies the supplied handle, and preserves the original exception when the error slot is absent or occupied. The direct addon transport is `CallbackFailure` in [`native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts). GTKX installs no GLib log handler: criticals and warnings reach GLib's default writer, as in C and GJS. Rust entry points guard unwinding at FFI boundaries; a panic in an exported addon function throws from that call, and a panic caught at a callback boundary is reported through Node's uncaught-exception channel.

The relevant sources are [`runtime/src/error.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/error.ts) and [`native/src/host/panic_handler.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/panic_handler.rs). The [Error Handling guide](/v2/guide/error-handling) explains native exceptions, promise rejections, GLib criticals, and addon panics. React error boundaries do not catch arbitrary signal-handler exceptions or asynchronous failures.

## Ownership boundaries {#native-boundary-audit}

The native package is an implementation detail. Its interface keeps JavaScript binding behavior in runtime and native lifetime mechanics in the addon. ABI metadata, field offsets, and library selection can live in TypeScript; native code owns the memory those operations access. [Native Ownership Boundaries](/contributing/native-ownership) explains why each operation below stays native and how runtime and the addon divide property storage, numeric transport, library handles, reference storage, Cairo paths, process supervision, and event-loop scheduling.

### Native operations {#export-dispositions}

| Operation                                                                | Responsibility                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compileDescriptor`, `bindFunction`, `createFunction`                    | Compile value codecs and signatures, and create native callback pointers or GClosures. Runtime supplies normalized descriptors and handlers.                                                                   |
| `alloc`, `readField`, `writeField`, `call`                               | Allocate storage, validate bounds and leases, invoke native functions, and settle ownership transfers.                                                                                                         |
| `reportExternalMemory`                                                   | Count native memory a handle keeps alive, such as an image surface's pixels, toward garbage collection until the handle is released.                                                                           |
| `releaseHandle`                                                          | Free an owned boxed value, or end a borrow, before collection when an API such as `Context[Symbol.dispose]()` asks; refuse while an operation still uses it.                                                   |
| `openLibrary`, `resolveSymbol`                                           | Open one library and resolve a symbol. Runtime chooses candidates and caches targets.                                                                                                                          |
| `getType`, `getTypeClass`, `registerClass`                               | Validate native types, own class and interface references, register GTypes, and retain callbacks. Runtime supplies class policy and metadata.                                                                  |
| `emitSignal`                                                             | Emit a signal from argument `GValue`s with an exact argument scope, so nested emissions of the same signal stay distinct. Runtime converts the arguments and return value.                                     |
| `getFundamentalIdentity`                                                 | Report a fundamental instance's identity and whether the handle owns a reference, for the runtime's fundamental wrapper cache.                                                                                 |
| `getWrapper`, `setWrapper`, `setWrapperBorrow`                           | Coordinate GObject references, JavaScript wrapper reachability, dependent borrows, and cleanup ordering.                                                                                                       |
| `deferFinalization`                                                      | Keep a disposed object allocated until a dependent object is finalized, for upstream code that writes into it from the dependent's finalization.                                                               |
| `newObject`, `getObjectProperty`, `setObjectProperty`, `setValuePointer` | Preserve construction and property-storage lifetimes, including callback dependencies and reentrant calls.                                                                                                     |
| `init`, `quit`                                                           | Acquire and release native event-loop resources; `quit` first ends objects only their wrappers reference. Runtime initializes the addon, supplies its dispatch budget, and owns keep-alive and exit callbacks. |

See [`packages/native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts) for the current addon contract. The CLI owns the binary locator so packaging tools can find the addon without loading it.
