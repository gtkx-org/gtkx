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
4. [`native/src/api/call.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/call.rs) accepts normalized arguments or requests them sequentially from a runtime producer. It retains reference seeds before requesting the next argument, then prepares native storage, invokes the target, and returns the result and output values while settling ownership transfers.
5. The TypeScript runtime converts returned values, updates JavaScript references, reports errors, and combines output values into the public return shape.

Compiled value descriptors, function signatures, and executable targets have independent lifetimes and can be reused. A lazy runtime function specification defers creating the bound callable until its first invocation. [`runtime/src/native-bindings.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/native-bindings.ts) chooses the first loadable shared-library candidate and caches its executable handle after successful resolution. Native [`ffi/library_cache.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/library_cache.rs) opens individual libraries with process-wide lifetime and resolves symbols through owned library handles. A missing symbol never causes a search in a later candidate library.

Native calls also check argument counts, and object codecs check declared native types when those types can be resolved.

The runtime retains compiled descriptor handles for field reads and writes and allocates scalar output storage by its ABI width. Function descriptors retain compiled signatures so field access does not rebuild callback call interfaces. Runtime also resolves and caches `get_type` results through ordinary function-pointer calls; native optional symbol lookup distinguishes absent symbols from library-loading failures. Descriptors arrive at the compiler with explicit storage flags, element ownership, and callback scope decisions, including inside record ABI layouts. Native validation enforces their layout and lifetime constraints.

`compileDescriptor` snapshots descriptor metadata into an owned native codec. Field access, pointer values, and function binding consume compiled descriptors, so repeated field reads and writes avoid descriptor parsing. Vfunc registration consumes a compiled function signature. Function signatures retain their codecs independently of the JavaScript descriptor handles. Lifecycle resolver functions run when needed, support retries, and are released with their Node environment.

Runtime also expands callback user-data and destroy-notify arguments, assigns their native positions, and calculates the expanded fixed-argument count for variadic calls. Reordering cannot move arguments across the fixed/variadic boundary. Native compilation validates the supplied permutation against the actual ABI argument count before building the call interface.

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

Executable targets also use opaque handles. Library symbols remain available with their library, call-scoped callbacks expire when their enclosing call ends, and one-shot callback handles expire before invocation. The runtime passes those handles directly to the native binding API.

Runtime supplies lazy GType and lifecycle-function resolvers through [`descriptor-lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/descriptor-lifecycle.ts). Native activates them when a codec needs the operation, including during output or callback decoding, so types registered by the callee remain visible. Unregistered types and failed lookups can be retried. Resolved lifecycle functions must come from permanently loaded libraries; native retains their handles, and destruction uses native function pointers without invoking JavaScript. Resolver callbacks belong to their Node environment and are released during environment teardown.

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

Process shutdown in [`runtime/src/lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/lifecycle.ts) runs registered exit callbacks, clears and disables its keep-alive timer, and tears down native integration before propagating cleanup errors. A failing callback cannot prevent the remaining cleanup, and repeated or reentrant shutdown does not run it twice.

Throwing native functions report `GError` through an out parameter that the TypeScript runtime turns into an exception. Runtime converts callback exceptions into owned `GError` values when the signature supplies an error slot. Native retains error-slot ABI metadata, validates and copies the supplied handle, and preserves the original exception when the error slot is absent or occupied. The direct addon transport is `CallbackFailure` in [`native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts). GTKX installs no GLib log handler: criticals and warnings reach GLib's default writer, as in C and GJS. Rust entry points guard unwinding at FFI boundaries; a panic in an exported addon function throws from that call, and a panic caught at a callback boundary is reported through Node's uncaught-exception channel.

The relevant sources are [`runtime/src/error.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/error.ts) and [`native/src/host/panic_handler.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/panic_handler.rs). The [Error Handling guide](/v2/guide/error-handling) explains native exceptions, promise rejections, GLib criticals, and addon panics. React error boundaries do not catch arbitrary signal-handler exceptions or asynchronous failures.

## Ownership boundaries {#native-boundary-audit}

The native package is an implementation detail. Its interface keeps JavaScript binding behavior in runtime and native lifetime mechanics in the addon. ABI metadata, field offsets, and library selection can live in TypeScript; native code owns the memory those operations access.

### Native operations {#export-dispositions}

| Operation                                                                | Responsibility                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compileDescriptor`, `bindFunction`, `createFunction`                    | Compile value codecs and signatures, and create native callback pointers or GClosures. Runtime supplies normalized descriptors and handlers.          |
| `alloc`, `readField`, `writeField`, `call`                               | Allocate storage, validate bounds and leases, invoke native functions, and settle ownership transfers.                                                |
| `openLibrary`, `resolveSymbol`                                           | Open one library and resolve a symbol. Runtime chooses candidates and caches targets.                                                                 |
| `getType`, `getTypeClass`, `registerClass`                               | Validate native types, own class and interface references, register GTypes, and retain callbacks. Runtime supplies class policy and metadata.         |
| `getWrapper`, `setWrapper`, `setWrapperBorrow`                           | Coordinate GObject references, JavaScript wrapper reachability, dependent borrows, and cleanup ordering.                                              |
| `newObject`, `getObjectProperty`, `setObjectProperty`, `setValuePointer` | Preserve construction and property-storage lifetimes, including callback dependencies and reentrant calls.                                            |
| `init`, `quit`                                                           | Acquire and release native event-loop resources. Runtime initializes the addon, supplies its dispatch budget, and owns keep-alive and exit callbacks. |

See [`packages/native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts) for the current addon contract. The CLI owns the binary locator so packaging tools can find the addon without loading it.

### Properties and wrapper dependencies

Runtime keeps property names, flags, value guards, JavaScript accessors, notification policy, and class/interface registration policy. Its `GParamSpec` field offsets and layout probes remain JavaScript ABI knowledge. Probe values, class references, and default-interface references use handles with native release operations instead of paired JavaScript ref/unref calls.

Property validation uses a fresh GC-owned `GValue` for each operation. A class-level scratch `GValue` would retain its last object or boxed payload after the instance that owned the property had been collected. Metadata caches retain metadata, not the last assigned value.

Pointer-valued `GValue`s own their encoded backing storage in native handles. Property assignment and construction attach callback storage to the receiving native object. Native-managed weak-key associations keep JavaScript callback dependencies visible to V8, including callbacks that capture their owner, while native attachment ownership keeps the executable storage valid through replacement and finalization.

`setValuePointer` writes the encoded pointer and retains its backing storage together. `getObjectProperty` and `setObjectProperty` preserve these dependencies through reentrant native property calls and deferred object destruction. Replacing them with ordinary FFI calls and JavaScript retention maps would release some callback storage before native finalization finishes, so these ownership operations remain native.

Native retains candidate callback storage before entering a property setter. After the setter returns, including when it logs a GLib critical, native reads the resulting pointer of a readable property and reconciles retained storage with that value. This covers nested writes both before and after the outer setter stores its pointer. For write-only properties or getters that reenter a write, native conservatively retains candidates until a later reliable read or object finalization can release them.

Reading a callback property returns a snapshot that retains its trampoline independently of later property replacement or clearing. Constructor values remain retained through native construction, and final property reconciliation preserves the values actually stored after reentrant replacements or clearing.

Library overrides can identify a borrowed relationship that needs protection. The Window override supplies the native default-widget setter to `setWrapperBorrow`; native retains the dependent wrapper, leases both objects during cleanup, and clears the pointer directly before deferred wrapper teardown. The override neither keeps its own retention map nor constructs a JavaScript wrapper to perform cleanup.

Library compatibility workarounds remain in overrides. Sidebar detaches retired models and explicitly disposes detached rows, because libadwaita leaves views retired by a mode change connected to their models. ComboRow disconnects the native handlers its default factory and item boxes hold, because libadwaita does not tie them to the row's lifetime. Both are permanent. These calls change library behavior and are distinct from balancing references on runtime-owned handles.

### Descriptor normalization

Runtime owns callback and class-registration defaults, storage flags, reference direction, and array element ownership. Public descriptors remain concise, while the native schema requires explicit values. Function arguments, return values, fields, callbacks, references, nested collections, and record `abiFields` share the runtime conversion plans. Bootstrap scalar bindings already supply complete descriptors; enum lookup lowers its pointer and string descriptors when invoked, avoiding module-initialization cycles.

Native retains validation of ABI layouts, ownership combinations, callback retention, extents, and recursion bounds, without duplicating descriptor defaults. Runtime rejects cyclic descriptors before recursive lowering.

Argument layout preserves fixed-prefix expansion and rejects permutations that move hidden arguments across the fixed/variadic boundary. Reordering within either region remains supported.

### Numeric policy and collection transport

Runtime validates JavaScript numbers, checks public integer ranges and finite float32 overflow, and converts between number and bigint. Number64 accepts the inclusive `-2^53..2^53` interval. Float32 accepts NaN and infinities. Native validates that normalized values fit their ABI storage.

Native 64-bit integer descriptors carry bigint values and an explicit `isDirectWord` flag. Runtime sets it for public Number64 descriptors, preserving direct hashing and signed pointer-word list entries. Ordinary bigint hash values use allocated scalars. Bigint keys are unsupported, and ordinary bigint pointer lists require nonnegative words. Contiguous C/GArray storage and matching typed-buffer passthrough remain distinct from pointer collections. Typed-array offsets and writes are preserved; incompatible views are rejected.

Array lengths are extracted exactly from integer and bigint arguments or references, then checked against platform sizes and native extents. Runtime validates hash-entry tuples and converts iterables before native allocation. Native retains traversal, terminators, stride/extent checks, backing-store validity, ownership/destructor pairing, duplicate replacement, and partial-encoding rollback. Nested records, references, callbacks, and collection elements use the same runtime conversion plans.

### Library handles, lifecycle resolution, and binding targets

Native provides owned `openLibrary(candidate)` and `resolveSymbol(libraryHandle, symbol, optional)` primitives. Runtime chooses comma-separated candidates and caches the chosen handle. Resolution uses the **first loadable library**: a missing symbol does not cause a search in subsequent candidates. Native retains the loader flags and process-wide library lifetime. Optional resolution suppresses only missing symbols; loading and malformed-name errors propagate.

Runtime supplies lazy functions for descriptor GTypes and copy/ref/free operations. Native retains those functions directly from the descriptor and activates them at the codec's acquisition boundary, preserving registration after descriptor creation and during a native call. Successful resolutions are cached; unregistered names and failed function lookups remain retryable. Native validates types, ref/unref pairs, and reusable library-backed function handles. Resolved destruction operations remain callable after their JavaScript wrappers or environment are released. Foreign-record conversion strategies resolve native operations at the same acquisition boundary.

`bindFunction` accepts compiled argument and return descriptors and compiles a signature independently of its target. Runtime retains that signature and lazily caches the executable handle, passing both to native `call`. Compatible signatures also create callback trampolines through `createFunction`; nested callback descriptors reference a compiled signature instead of rebuilding their call interface for each callback instance. Native validates the signature's calling convention for its use, including variadic arguments and hidden callback error outputs. Descriptor compilation validates value layout; signature binding separately validates whether those values support calls or callbacks.

Native checks the target's borrow lifetime and acquires its lease on each invocation, consuming one-shot targets before calling them. Runtime validates vfunc offsets and lazily acquires a bounded class, implemented-interface, or default-interface handle through `getTypeClass`. It reads the executable target with `readField`, which checks the field extent and retains the owning vtable. Empty implementations fail when resolved. Class and interface references are released when no dependent handle remains.

### Non-scalar reference storage

Runtime requests storage for scalar references; native code owns the allocation. Non-scalar reference descriptors compile recursively through `compileDescriptor` and are retained by the call signature. Calls accept ordinary normalized `{ value }` cells, with storage derived from the descriptor and seed. Runtime supplies owned `alloc` handles for caller-allocated C arrays. Native validates their bounds and retains the owner; GLib containers still require their native container layout and lifecycle.

Native `call` accepts an argument array or an `(index) => value` producer. Runtime uses the producer so native can capture each converted reference seed and acquire its native owners before the next conversion can reenter JavaScript or trigger collection. ABI storage is prepared only after every argument has been normalized, so later conversions cannot invalidate an already-prepared typed-array pointer. Each invocation owns its temporary transaction; cells can be reused without exposing a separate storage handle or mode enum.

Native preserves synchronous typed-array views, checks returned extents against remaining capacity, distinguishes unchanged/null/replacement pointers, adopts or copies replacements, and settles transfers. Output decoding visits remaining outputs even after an earlier conversion fails, so their native allocations are released. Runtime updates public reference cells after decoding their results.

Asynchronous non-scalar references must borrow the output and its elements: the synchronous result API cannot release transferred outputs before completion. Native rejects incompatible transfer contracts before calling C and retains borrowed reference transactions, including independent buffer copies and native owners, until completion.

Callback references exchange normalized values through ordinary JavaScript cells. Runtime exposes the public reference object and converts its replacement; native writes each ABI output and retains its acquired storage. The cell carries JavaScript values rather than access to caller-owned ABI memory. Native handles borrowed by those values still expire with the invocation. Output writes are sequential.

### Cairo path conversion

Runtime selects the Cairo path conversion strategy and includes its options and lazy operation resolvers in the struct descriptor. `compileDescriptor` snapshots those options with the value codec; there is no separate converter factory or opaque converter handle. Native creates a temporary surface and context, appends and copies the source path, checks status, and releases temporary resources through Rust-owned scopes.

Native validates that the result uses the declared path destructor and transfers the copied allocation into the pending ownership transaction. Borrowed outputs and transfer-full inputs, including callback returns, share this acquisition boundary. Failure cleanup preserves the original source.

### Process supervision

The CLI supervises its application runner, forwards shutdown signals, and forces termination if shutdown times out. The runner exits when its IPC connection to the CLI closes. Headless compositors and session buses are released during normal teardown; subsequent Vitest, dev or Storybook startup, or `gtkx cleanup`, reclaims stale sessions left by interrupted runs.

### Event-loop scheduling

Runtime controls initialization order; native `init` installs the Node environment and GLib context. Imports must initialize through a shared runtime adapter before leaf modules create bindings. Native cleanup hooks remain essential when worker termination prevents JavaScript cleanup.

Runtime supplies the dispatch budget, currently four milliseconds. Native validates it before initialization and retains GLib context ownership, readiness storage, libuv handle reconciliation and close callbacks, N-API callback/error scopes, thread confinement, and unconditional teardown.

The [scheduler benchmark](https://github.com/gtkx-org/gtkx/blob/main/packages/native/tools/scheduler-benchmark.ts) compares native scheduling with a copied readiness snapshot and a JavaScript callback per cycle. Run `node packages/native/tools/scheduler-benchmark.ts` from the repository root. It measures per-cycle copy and callback overhead. Use application-level latency measurements as well when evaluating changes to the scheduling boundary.

Verify ownership and callback changes through the [native fixtures and sanitizers](/contributing/testing#native-fixtures-and-sanitizers). Runtime process tests cover startup, shutdown, worker isolation, and logging; generated-binding integration tests exercise value conversion and native lifetimes.
