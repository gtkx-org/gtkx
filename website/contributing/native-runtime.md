---
title: "Native Runtime"
description: "GTKX's TypeScript runtime, Rust FFI bridge, native ownership model, callback handling, and GLib integration."
---

# Native Runtime

`@gtkx/runtime` implements JavaScript binding behavior. The Rust addon, `@gtkx/native`, handles ABI operations, native memory, and Node integration. Generated GI code supplies their signatures and metadata; JavaScript uses safe handles without manipulating raw pointers.

The ownership boundary is who acquires, retains, transfers, and releases native memory. TypeScript may describe ABI layouts, inspect fields through checked handles, pack arguments, select native functions, and implement library behavior. Generated transfer annotations and copy/ref/free symbols are declarative inputs to native ownership; they are not JavaScript instructions to balance references manually.

Handles normally become eligible for native cleanup through JavaScript garbage collection. Native code owns temporary allocations, active-call leases, callback trampolines, and dependencies that must survive wrapper collection. Application operations such as closing a window, completing a stream, or finishing a Cairo surface remain available because they change library behavior independently of handle collection.

The Rust crate builds a Node addon through napi-rs and uses libffi for native calls, libloading for shared libraries, and the Rust GLib bindings for GLib and GObject operations. Its dependencies and supported addon targets are declared in [`packages/native/Cargo.toml`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/Cargo.toml) and [`packages/native/package.json`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/package.json).

## From a JavaScript method to a C call

The central contract is a descriptor: a structured description of a value's native representation and how it crosses the boundary. Descriptors distinguish scalars, strings, objects, boxed values, records, arrays, hash tables, callbacks, and references. They also carry details such as ownership, element layout, and native type names.

A call passes through these stages:

1. A generated adapter presents the public JavaScript signature and supplies a runtime function specification.
2. [`runtime/src/fn.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/fn.ts) plans inputs and outputs and wraps callbacks. Shared runtime conversion plans validate public numbers, encode strings as UTF-8 bytes, prepare owned reference storage, and lower booleans, Unicode characters, enums, and flags to their ABI representations.
3. Native `compileDescriptor` prepares reusable value codecs. [`native/src/api/bind.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/bind.rs) combines those compiled descriptors with the argument layout to prepare a libffi call interface. Runtime resolves and caches the symbol or vtable slot lazily, then passes its executable handle alongside the compiled signature.
4. [`native/src/api/call.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/call.rs) prepares native storage, invokes the target, and returns the result and output values while settling ownership transfers.
5. The TypeScript runtime converts returned values, updates JavaScript references, reports errors, and packs surfaced outputs into the public return shape.

Compiled value descriptors, function signatures, and executable targets have independent lifetimes and can be reused. A lazy runtime function specification defers creating the bound callable until its first invocation. [`runtime/src/native-bindings.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/native-bindings.ts) chooses the first loadable shared-library candidate and caches its executable handle after successful resolution. Native [`ffi/library_cache.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/library_cache.rs) opens individual libraries with process-wide lifetime and resolves symbols through owned library handles. A missing symbol never causes a search in a later candidate library.

Native calls also check argument counts, and object codecs check declared native types when those types can be resolved.

The runtime retains compiled descriptor handles for field reads and writes and allocates scalar output storage by its ABI width. Function descriptors retain compiled signatures so field access does not rebuild callback call interfaces. Runtime also resolves and caches `get_type` results through ordinary function-pointer calls; native optional symbol lookup distinguishes absent symbols from library-loading failures. Descriptors arrive at the compiler with explicit storage flags, element ownership, and callback scope decisions, including inside record ABI layouts. Native validation enforces their layout and lifetime constraints.

`compileDescriptor` snapshots descriptor metadata into an owned native codec. Field access, pointer values, function binding, and vfunc registration consume compiled descriptors, so repeated field reads and writes avoid descriptor parsing. Function signatures retain their codecs independently of the JavaScript descriptor handles. Lifecycle resolver functions remain lazy and retain their existing retry and environment-cleanup behavior.

Runtime also expands callback user-data and destroy-notify arguments, assigns their native positions, and calculates the expanded fixed-argument count for variadic calls. Reordering cannot move arguments across the fixed/variadic boundary. Native compilation validates the supplied permutation against the actual ABI argument count before building the call interface.

## Values, temporary storage, and ownership

The runtime's shared conversion plans serve calls, fields, callbacks, references, and collections. They normalize scalar and collection inputs, encode and decode strings, and choose their public JavaScript representations. The native [`ffi/codec`](https://github.com/gtkx-org/gtkx/tree/main/packages/native/src/ffi/codec) modules pack those normalized values into ABI storage and C or GLib containers, retaining responsibility for bounds, terminators, traversal, allocation, and ownership. A `Stash` holds an invocation's temporary allocations, callback state, and pending ownership transfers.

Ownership is directional. Passing a borrowed value to C differs from handing ownership to C; receiving a borrowed pointer differs from receiving a newly owned allocation. A container's allocation and its elements can also have distinct transfer requirements. The generated descriptor supplies those rules, and the relevant codec acquires, copies, transfers, or releases memory accordingly.

Pending transfers are committed after the native call. Until then, temporary storage can release allocations if preparation fails. For asynchronous calls, runtime recognizes the GIO completion-callback signature and the addon retains the required argument storage and owners until completion. This recognition remains a runtime heuristic; native validates the selected callback and manages the retained memory. Replacing the heuristic with explicit generated completion metadata is a future improvement. A temporary buffer cannot escape without a lifetime that safely covers its use.

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

[`ffi/closure.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/closure.rs) tracks callback invocations in flight and defers destruction when cleanup is requested from inside a callback. One-shot completion callbacks, destroy notifications, and callbacks with no release mechanism have different retention paths. The lifetime of a callback is therefore part of the native signature, not something JavaScript garbage collection can infer by itself.

GObject signals use the runtime's [`signal.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/signal.ts), [`closure.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/closure.ts), and [`listeners.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/listeners.ts). These handle signal lookup, connection and disconnection, and JavaScript value marshalling. Native `createFunction` accepts a compiled signature and a pointer or closure descriptor. Its closure form allocates and sinks the `GClosure`, installs its marshal, and releases the callback trampoline when the closure is finalized. Runtime finalization callbacks only retire JavaScript connection bookkeeping. The React renderer builds signal props on top of that API.

Promise wrappers for GIO-style operations remain a separate layer. [`promisify.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/promisify.ts) invokes the start function, receives its asynchronous result, calls the finish function, and resolves or rejects the promise. Native asynchronous storage retention still has to be correct underneath that promise. See [Async Operations](/v2/guide/async-operations) for the public behavior.

## Registering native subclasses

`registerClass` creates a native GType for a JavaScript subclass and installs the properties, signals, interfaces, and virtual-function overrides it declares. Generated metadata identifies vtable slots and their signatures. The runtime bridges an override to a native callback and provides calls back into parent implementations.

[`runtime/src/register-class.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/register-class.ts) owns signal rules, interface ordering, property overrides, class flags, and CSS naming. The runtime's `vfunc` modules supply the callback conventions; [`native/src/api/register_class.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/api/register_class.rs) retains class allocation and callback lifetime mechanics. A JavaScript class hierarchy alone does not register a GType. The [Subclassing guide](/v2/guide/subclassing) describes the application API.

## GLib inside Node's event loop

Importing the runtime initializes the native addon through [`runtime/src/native.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/native.ts) before runtime modules create bindings. Importing the addon alone does not acquire a GLib context. [`runloop.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/runloop.rs) acquires GLib's default main context on that Node thread and connects it to the thread's libuv loop.

The integration uses three kinds of libuv handle:

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

[`runtime/src/lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/lifecycle.ts) starts GTKX-created applications through GLib's local command-line handling. That preserves GLib option parsing, registration, activation, and forwarding to an existing application instance while keeping Node as the outer loop.

The runtime records whether an application is primary, remote, unregistered, or shut down. React waits for activation before mounting application children, avoiding window creation in a remote process. On teardown, GTKX detaches application windows and reaches GLib's shutdown path through an adapted `g_application_run()` call once it can complete without owning the normal application loop. It also releases the process-wide default application association.

Runtime shutdown runs registered exit callbacks, clears and disables its keep-alive timer, and tears down native integration before propagating cleanup errors. A failing callback cannot prevent the remaining cleanup, and repeated or reentrant shutdown does not run it twice.

Errors need to cross the same boundaries as successful results. Throwing native functions report `GError` through an out parameter that the TypeScript runtime turns into an exception. Runtime converts callback exceptions into owned `GError` values when the signature supplies an error slot. Native retains error-slot ABI metadata, validates and copies the supplied handle, and preserves the original exception when the error slot is absent or occupied. The direct addon transport is `CallbackFailure` in [`native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts). GLib criticals raised during a bound call are collected and reported after the call returns, and Rust entry points guard unwinding at FFI boundaries.

The relevant sources are [`runtime/src/error.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/error.ts), [`native/src/host/log_writer.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/log_writer.rs), and [`native/src/host/panic_handler.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/panic_handler.rs). The [Error Handling guide](/v2/guide/error-handling) explains native exceptions, promise rejections, and failures that terminate the process. React error boundaries do not catch arbitrary signal-handler exceptions or asynchronous failures.

## Native boundary audit

The native package is an implementation detail, so its interface can change to keep JavaScript behavior in runtime and native lifetime mechanics in the addon. This does not require moving ABI metadata, field offsets, or every library call into Rust. All native functions share the `@gtkx/native` entrypoint. The addon binary locator lives in the CLI so tooling can locate binaries without loading the addon.

### Export dispositions

| Exports                                                                      | Disposition                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`, `write`, `bindField`                                                 | Removed from native; checked field reads and writes consume reusable handles from the generic `compileDescriptor` API.                                                                                                                              |
| `allocField`                                                                 | Removed from native; runtime chooses scalar storage widths and calls `alloc`.                                                                                                                                                                       |
| `resolveType`                                                                | Removed from native; runtime resolves, invokes, and caches `get_type`. Codec type discovery also uses lazy runtime resolvers.                                                                                                                       |
| `getFundamentalWrapper`, `setFundamentalWrapper`                             | Removed from native; runtime owns weak identity caching over `getFundamentalIdentity`.                                                                                                                                                              |
| `onLog`                                                                      | Runtime owns subscriptions and fanout over one native sink per environment. Native serializes copied records and subscription fences.                                                                                                               |
| `bind`, `bindFunctionPointer`, `bindVfunc`, `attachCall`                     | Removed from native; runtime retains the compiled signature and executable handle separately, preserving eager signature validation and lazy targets. Native `call` validates the executable handle on each invocation.                             |
| `registerClass`                                                              | Runtime supplies class flags, empty override/interface lists, and callback defaults. Native retains irreversible GType registration, size/slot checks, and permanent callback storage.                                                              |
| `init`                                                                       | Runtime owns automatic initialization and supplies the dispatch budget. Native retains ordered environment and GLib-context installation. Scheduler measurements are discussed below.                                                               |
| `alloc`, `readField`, `writeField`, `call`                                   | Keep native allocation, ABI access, pointer leases, and transfer transactions. Runtime owns public numeric/collection representation and prepares explicit reference storage.                                                                       |
| `copy`, `createRecordConverter`                                              | Native owns copying and temporary cleanup. Runtime supplies a native conversion strategy and lazy library operations.                                                                                                                               |
| `disposeHandle`                                                              | Removed. Ordinary handles follow garbage collection; temporary conversion resources are scoped inside native code.                                                                                                                                  |
| `resolveFunction`, `resolveFunctionOptional`, `readFunctionPointer`          | Named resolution moved to runtime over `openLibrary` and `resolveSymbol`. The separate raw function-pointer reader was removed; native creates closure and vtable executable handles.                                                               |
| `getType`, `getTypeClass`                                                    | Keep native instance-header access, GType validation, and class/interface-reference ownership. Function field reads retain their owning vtable. Runtime chooses wrapper classes and caches public type lookup.                                      |
| `getWrapper`, `setWrapper`, `setWrapperBorrow`                               | Keep GObject toggle references, strong/weak N-API transitions, dependent borrows, and cleanup ordering. Borrow cleanup invokes a retained native setter directly, with native-managed wrapper retention.                                            |
| `newObject`                                                                  | Keep construction transaction: pending wrappers during early instance initialization, singleton reuse, temporary GValues, floating references, and callback failure cleanup. No independent policy extraction currently justifies another protocol. |
| `encodePointer`, `retainPropertyPointer`                                     | Replaced by `setValuePointer` and `setObjectProperty`. Native owns encoded backing storage and adopts callback dependencies during property assignment and construction.                                                                            |
| `compileDescriptor`, `bindFunction`, `createFunction`                        | Compile value codecs independently of function signatures. Share signatures across calls and callback trampolines; one factory creates pointers or GClosures with their native ownership rules.                                                     |
| `createFunctionResolver`, `createTypeResolver`                               | Removed. Descriptors accept lazy resolver functions directly; native owns the resolution cache and validates operations before acquiring resources.                                                                                                 |
| `compileVfuncSlot`, `readVfuncSlot`                                          | Removed. Runtime reads function fields from owned, bounded class or interface handles.                                                                                                                                                              |
| `compileReference`, `createReferenceStorage`                                 | Separate reference compilation was removed; recursive descriptors use `compileDescriptor`. Native storage creation uses that signature's argument codec and retains seeds until its single-use transaction is consumed.                             |
| `readReferenceStorage`, `writeReferenceStorage`                              | Removed. Callback references exchange normalized JavaScript cells; native retains responsibility for ABI output storage and borrow expiry.                                                                                                          |
| `createMatchSubject`, `getMatchInfoType`, `ownMatchInfo`, `getMatchInfoBase` | Native allocates terminated subject storage and owns it together with match information, including copies and borrowed views. Runtime supplies text encoding and regex behavior.                                                                    |
| `keepAlive`, `quit`                                                          | `keepAlive` moved to a runtime-owned Node timer. Native `quit` retains teardown of its event-loop handles; runtime owns exit callbacks and error aggregation.                                                                                       |
| `resolveBinding`                                                             | CLI-owned JavaScript packaging logic in `cli/src/internal/native-binding.ts`; locates the addon binary without loading it.                                                                                                                          |

The sections below describe the implemented ownership boundaries. The full scheduler split was evaluated with an isolated benchmark and is not adopted; native retains the scheduling machinery described below.

### Properties and wrapper dependencies

Runtime keeps property names, flags, value guards, JavaScript accessors, notification policy, and class/interface registration policy. Its `GParamSpec` field offsets and layout probes remain JavaScript ABI knowledge. Probe values, class references, and default-interface references use handles with native release operations instead of paired JavaScript ref/unref calls.

Property validation uses a fresh GC-owned `GValue` for each operation. A class-level scratch `GValue` would retain its last object or boxed payload after the instance that owned the property had been collected. Metadata caches retain metadata, not the last assigned value.

Pointer-valued `GValue`s own their encoded backing storage in native handles. Property assignment and construction attach callback storage to the receiving native object. Native-managed weak-key associations keep JavaScript callback dependencies visible to V8, including callbacks that capture their owner, while native attachment ownership keeps the executable storage valid through replacement and finalization.

`setValuePointer` writes the encoded pointer and retains its backing storage together. `getObjectProperty` and `setObjectProperty` preserve these dependencies through reentrant native property calls and deferred object destruction. Replacing them with ordinary FFI calls and JavaScript retention maps would release some callback storage before native finalization finishes, so these ownership operations remain native.

Native retains candidate callback storage before entering a property setter. After the setter returns, including when it reports a GLib critical, native reads the resulting pointer of a readable property and reconciles retained storage with that value. This covers nested writes both before and after the outer setter stores its pointer. For write-only properties, failed reads, or getters that reenter a write, native conservatively retains candidates until a later reliable read or object finalization can release them.

Reading a callback property returns a snapshot that retains its trampoline independently of later property replacement or clearing. Constructor values remain retained through native construction, and final property reconciliation preserves the values actually stored after reentrant replacements or clearing.

Library overrides can identify a borrowed relationship that needs protection. The Window override supplies the native default-widget setter to `setWrapperBorrow`; native retains the dependent wrapper, leases both objects during cleanup, and clears the pointer directly before deferred wrapper teardown. The override neither keeps its own retention map nor constructs a JavaScript wrapper to perform cleanup.

Library compatibility workarounds remain in overrides. Sidebar detaches retired models and explicitly disposes detached rows for [issue #726](https://github.com/gtkx-org/gtkx/issues/726); ComboRow disconnects native handlers for [issue #727](https://github.com/gtkx-org/gtkx/issues/727). These calls change library behavior and are distinct from balancing references on runtime-owned handles.

### Descriptor normalization

Runtime owns callback and class-registration defaults, storage flags, reference direction, and array element ownership. Public descriptors remain concise, while the native schema requires explicit values. Function arguments, return values, fields, callbacks, references, nested collections, and record `abiFields` share the runtime conversion plans. Bootstrap scalar bindings already supply complete descriptors; enum lookup lowers its pointer and string descriptors when invoked, avoiding module-initialization cycles.

Native retains validation of ABI layouts, ownership combinations, callback retention, extents, and recursion bounds, without duplicating descriptor defaults. Runtime rejects cyclic descriptors before recursive lowering. ABI-validation regressions exercise public scalar descriptors inside boxed and struct record layouts, malformed nested fields, depth limits, and recovery after a cycle is corrected. Native validation error formatting remains unchanged.

Argument layout preserves fixed-prefix expansion and rejects permutations that move hidden arguments across the fixed/variadic boundary. A GIO variadic regression combines a callback in the fixed prefix with integer and floating arguments, verifies callback delivery and the formatted error, and covers implicit and explicit user-data positions. Reordering within either region remains supported.

### Numeric policy and collection transport

Runtime owns Number admission, public integer ranges, finite float32 overflow checks, and Number/bigint conversion. Number64 retains the inclusive `-2^53..2^53` interval. Float32 still accepts NaN and infinities. Native retains validation that normalized values fit their ABI storage; it no longer implements the public Number64 interval or float32 overflow policy.

Native 64-bit integer descriptors carry bigint values and an explicit `isDirectWord` flag. Runtime sets it for public Number64 descriptors, preserving direct hashing and signed pointer-word list entries. Ordinary bigint hash values still use allocated scalars, bigint keys remain unsupported, and ordinary bigint pointer lists retain their nonnegative-word requirement. Contiguous C/GArray storage and matching typed-buffer passthrough remain distinct from pointer collections. Typed-array offsets and writes are preserved; incompatible views are rejected.

Array lengths are extracted exactly from integer and bigint arguments or references, then checked against platform sizes and native extents. Runtime validates hash-entry tuples and converts iterables before native allocation. Native retains traversal, terminators, stride/extent checks, backing-store validity, ownership/destructor pairing, duplicate replacement, and partial-encoding rollback. Nested records, references, callbacks, and collection elements use the same runtime conversion plans.

Coverage includes Number64 direct-word entries, negative list words, exact bigint lengths, overflow when decoding returned values, typed-array subview mutation, duplicate normalized keys, asynchronous buffer retention, and failed nested conversion under sanitizers.

### Library handles, lifecycle resolution, and binding targets

Native provides owned `openLibrary(candidate)` and `resolveSymbol(libraryHandle, symbol, optional)` primitives. Runtime chooses comma-separated candidates and caches the chosen handle. The **first loadable library** rule is preserved: a missing symbol does not cause a search in subsequent candidates. Native retains the loader flags and process-wide library lifetime. Optional resolution suppresses only missing symbols; loading and malformed-name errors propagate.

Runtime supplies lazy functions for descriptor GTypes and copy/ref/free operations. Native retains those functions directly from the descriptor and activates them at the codec's acquisition boundary, preserving registration after descriptor creation and during a native call. Successful resolutions are cached; unregistered names and failed function lookups remain retryable. Native validates types, ref/unref pairs, and reusable library-backed function handles. Resolved destruction operations remain callable after their JavaScript wrappers or environment are released. Foreign-record conversion strategies resolve native operations at the same acquisition boundary.

`bindFunction` accepts compiled argument and return descriptors and compiles a signature independently of its target. Runtime retains that signature and lazily caches the executable handle, passing both to native `call`. Compatible signatures also create callback trampolines through `createFunction`; nested callback descriptors reference a compiled signature instead of rebuilding their call interface for each callback instance. Native validates the signature's calling convention for its use, including variadic arguments and hidden callback error outputs. Descriptor compilation validates value layout; signature binding separately validates whether those values support calls or callbacks.

Native checks the target's borrow lifetime and acquires its lease on each invocation, consuming one-shot targets before calling them. Runtime validates vfunc offsets and lazily acquires a bounded class, implemented-interface, or default-interface handle through `getTypeClass`. It reads the executable target with `readField`, which checks the field extent and retains the owning vtable. Empty implementations fail when resolved. Class and interface references are released when no dependent handle remains.

Integration coverage includes late type registration, missing lifecycle symbols at use, invalid ref/unref pairs, handles surviving collection, separate environments and shutdown, lazy missing targets, and interface/class slot failures. Field and pointer encoding isolate resolver exceptions so JavaScript can catch a nested failure without poisoning an enclosing native callback. Native codecs no longer select libraries or resolve lifecycle names.

### Non-scalar reference storage

Scalar references use runtime-requested, native-owned allocated storage. Non-scalar reference descriptors compile recursively through `compileDescriptor` and are retained by the call signature. Runtime extracts public `{ value }` objects and explicitly selects slot, inout, fixed-byte, caller-array, caller-container, or seeded-array storage. `createReferenceStorage` receives the compiled signature and logical argument index, so it uses the exact reference codec that will consume the storage without a separate reference-descriptor export.

Native validates storage against its compiled argument codec and consumes each prepared transaction once. Runtime creates each argument's storage immediately after conversion, before converting the next argument. The storage retains normalized seeds and their native owners across reentrant conversions and garbage collection; its matching call prepares ABI memory inside the call's lease scope, preserving synchronous typed-array views. Native distinguishes unchanged/null/replacement pointers, adopts or copies replacements, and settles transfers. Output decoding visits remaining outputs even after an earlier conversion fails, so their native allocations are released.

Asynchronous non-scalar references must borrow the output and its elements: the synchronous result API cannot release transferred outputs before completion. Native rejects incompatible transfer contracts before calling C and retains borrowed reference transactions, including independent buffer copies and native owners, until completion.

Callback references exchange normalized values through ordinary JavaScript cells. Runtime exposes the public reference object and converts its replacement; native writes each ABI output and retains its acquired storage. The cell carries JavaScript values rather than access to caller-owned ABI memory. Native handles borrowed by those values still expire with the invocation. Output writes are sequential, preserving the existing callback contract. Coverage exercises replacement, null, failed result conversion, descriptor mismatch, reuse, capacity overflow, and synchronous and asynchronous owner retention.

### Log subscriptions

Runtime owns subscriptions and fanout over one native sink per environment. Native enqueueing assigns a sequence, and subscription fences use the same synchronization. Each subscription covers a sequence interval. Unsubscribe closes the interval and queues a fence marker, allowing already-enqueued records to arrive before runtime releases the callback, even when no further logs are produced.

Native retains copying of borrowed GLib fields, thread-safe delivery, environment teardown, writer installation, fatal reporting, and nested synchronous critical traps. Runtime finishes fanout before throwing listener failures from the delivery callback. A single failure preserves its original value; multiple failures become an `AggregateError`. Native log records still arrive asynchronously, while sink installation and fence failures throw synchronously.

Integration coverage includes emit-then-unsubscribe before yielding, subscribe-after-emit, reentrant changes, multiple producer threads, throwing listeners, collection after the last fence, worker teardown, nested trapped criticals, and fatal subprocess diagnostics.

### Cairo path conversion

Runtime selects the Cairo path conversion strategy and supplies lazy resolvers for its native operations. The native `RecordConverter` creates a temporary surface and context, appends and copies the source path, checks status, and releases temporary resources through Rust-owned scopes. JavaScript does not execute a copy callback or manually dispose intermediate handles.

Native validates that the result uses the declared path destructor and transfers the copied allocation into the pending ownership transaction. Borrowed outputs and transfer-full inputs, including callback returns, share this acquisition boundary. Failure cleanup preserves the original source.

Coverage exercises native copy results, full-transfer callback paths, failed status cleanup, destructor mismatch, and the original value surviving failed transfer.

### Process supervision

The CLI supervises its application runner, forwards shutdown signals, and forces termination if shutdown times out. The runner exits when its IPC connection to the CLI closes. Headless compositors and session buses are released during normal teardown; subsequent Vitest, dev or Storybook startup, or `gtkx cleanup`, reclaims stale sessions left by interrupted runs.

### Event-loop scheduling

Runtime owns bootstrap orchestration; native `init` remains ordered installation of the Node environment and GLib context. Imports must initialize through a shared runtime adapter before leaf modules create bindings. Native cleanup hooks remain essential when worker termination prevents JavaScript cleanup.

Runtime supplies the dispatch budget, currently four milliseconds. Native validates it before initialization and retains GLib context ownership, readiness storage, libuv handle reconciliation and close callbacks, N-API callback/error scopes, thread confinement, and unconditional teardown.

Integration coverage includes worker termination/reacquisition and competing-worker rejection, descriptor removal/reuse, unwatchable descriptors, idle/timeouts, JavaScript timer fairness under continuously ready GLib sources, and quit during dispatch. Readiness tests await source callbacks without periodic JavaScript polling that could mask missing native wakeups. Existing keep-alive, quit-cleanup, exit-signal, and asynchronous callback suites also pass.

The reproducible experiment in [`native/tools/scheduler-benchmark.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/tools/scheduler-benchmark.ts) compares native policy with a copied readiness snapshot and one JavaScript callback per cycle. Run `node packages/native/tools/scheduler-benchmark.ts` from the repository root. Both paths perform real GLib iteration, prepare/query/check, and libuv poll/timer updates. After warmup, five interleaved samples measure 10,000 idle cycles or 100 continuously ready cycles with the four-millisecond budget.

Representative local results on Linux x64 with Node 26.8.2, in microseconds per cycle:

| Requested descriptors | Workload           | Native policy | JavaScript policy | Added cost |
| --------------------- | ------------------ | ------------- | ----------------- | ---------- |
| 0                     | Idle               | 0.64          | 1.79              | 1.15       |
| 8                     | Idle               | 3.88          | 7.92              | 4.05       |
| 64                    | Idle               | 29.02         | 52.45             | 23.43      |
| 8                     | Continuously ready | 4004.03       | 4008.13           | 4.11       |

The copied policy adds substantial relative cost to idle cycles and about 0.10% to a saturated four-millisecond cycle. This favorable prototype leaves poller reconciliation native and uses fewer crossings than a complete split. It is not an application-latency benchmark and does not evaluate an optimized zero-copy snapshot design. The current decision retains native scheduling machinery; a future extraction should demonstrate a concrete benefit with owned snapshots and end-to-end measurements. No bounded migration work remains.
