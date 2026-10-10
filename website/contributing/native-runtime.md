---
title: "Native Runtime"
description: "GTKX's TypeScript runtime, Rust FFI bridge, native ownership model, callback handling, and GLib integration."
---

# Native Runtime

`@gtkx/runtime` implements JavaScript binding behavior. The Rust addon, `@gtkx/native`, handles ABI operations, native memory, and Node integration. Generated GI code supplies their signatures and metadata; JavaScript uses safe handles without manipulating raw pointers.

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

Native calls also check argument counts, and object codecs check declared native types when those types can be resolved.

The runtime composes unbound field reads and writes from compiled native field accessors and allocates scalar output storage by its ABI width. It also resolves and caches `get_type` results through ordinary function-pointer calls; native optional symbol lookup distinguishes absent symbols from library-loading failures. Callback descriptors arrive at the addon with explicit defaults and scope decisions, while native validation enforces their lifetime constraints.

Runtime also expands callback user-data and destroy-notify arguments, assigns their native positions, and calculates the expanded fixed-argument count for variadic calls. Native compilation validates the supplied permutation against the actual ABI argument count before building the call interface.

## Values, temporary storage, and ownership

The runtime's shared conversion plans serve calls, fields, callbacks, references, and collections. They normalize scalar and collection inputs, encode and decode strings, and choose their public JavaScript representations. The native [`ffi/codec`](https://github.com/gtkx-org/gtkx/tree/main/packages/native/src/ffi/codec) modules pack those normalized values into ABI storage and C or GLib containers, retaining responsibility for bounds, terminators, traversal, allocation, and ownership. A `Stash` holds an invocation's temporary allocations, callback state, and pending ownership transfers.

Ownership is directional. Passing a borrowed value to C differs from handing ownership to C; receiving a borrowed pointer differs from receiving a newly owned allocation. A container's allocation and its elements can also have distinct transfer requirements. The generated descriptor supplies those rules, and the relevant codec acquires, copies, transfers, or releases memory accordingly.

Pending transfers are committed after the native call. Until then, temporary storage can release allocations if preparation fails. For asynchronous calls, runtime identifies the completion callback and the addon retains the required argument storage and owners until completion. A temporary buffer cannot escape without a lifetime that safely covers its use.

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

## Callbacks and signals

Callbacks reverse the FFI direction. A libffi closure supplies the C entry point, and the addon keeps callback state alive during each invocation. Runtime converts incoming values, invokes the JavaScript handler and prepares its return and output values. The addon reads and writes the corresponding ABI storage.

[`ffi/closure.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/closure.rs) tracks callback invocations in flight and defers destruction when cleanup is requested from inside a callback. One-shot completion callbacks, destroy notifications, and callbacks with no release mechanism have different retention paths. The lifetime of a callback is therefore part of the native signature, not something JavaScript garbage collection can infer by itself.

GObject signals use the runtime's [`signal.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/signal.ts), [`closure.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/closure.ts), and [`listeners.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/listeners.ts). These handle signal lookup, connection and disconnection, and closure marshalling. The React renderer builds signal props on top of that API.

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

Each prepare callback iterates the GLib context without blocking, stopping when there is no work or the current four-millisecond dispatch budget expires. It then queries GLib's next deadline and descriptors, updates poll handles, and arms the timer. The budget limits a batch of iterations; it cannot interrupt a long-running callback. Native dispatch runs within Node callback scopes so JavaScript callbacks and microtasks participate in Node's execution model.

The handles are normally unreferenced, so merely importing GTKX does not keep an otherwise idle Node process alive. Application activation requests a keep-alive reference; shutdown releases it. Environment cleanup releases the event-loop integration and its dispatch resources.

Only the owning thread can operate this GTKX runtime. Attempting to acquire the context from another thread while it is owned fails. Worker communication should carry plain data back to the owner; native objects and GTK operations stay there.

A standalone worker can initialize GTKX when no other thread has done so. Before terminating an owning worker, finish native operations or cancel them and await completion. Disconnect signal handlers and remove other native callback registrations, then call `quit()` from `@gtkx/runtime`. The worker must report cleanup completion before its parent calls `worker.terminate()`. `quit()` does not cancel operations or await their callbacks. Terminating a worker with live native operations or registrations is unsupported.

## Application lifecycle and errors

[`runtime/src/lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/lifecycle.ts) starts GTKX-created applications through GLib's local command-line handling. That preserves GLib option parsing, registration, activation, and forwarding to an existing application instance while keeping Node as the outer loop.

The runtime records whether an application is primary, remote, unregistered, or shut down. React waits for activation before mounting application children, avoiding window creation in a remote process. On teardown, GTKX detaches application windows and reaches GLib's shutdown path through an adapted `g_application_run()` call once it can complete without owning the normal application loop. It also releases the process-wide default application association.

Runtime shutdown runs registered exit callbacks and releases native keep-alive before propagating cleanup errors. A failing callback cannot prevent the remaining cleanup, and repeated or reentrant shutdown does not run it twice.

Errors need to cross the same boundaries as successful results. Throwing native functions report `GError` through an out parameter that the TypeScript runtime turns into an exception. Runtime converts callback exceptions into owned `GError` values when the signature supplies an error slot. Native retains error-slot ABI metadata, validates and copies the supplied handle, and preserves the original exception when the error slot is absent or occupied. The direct addon transport is `CallbackFailure` in [`native/main.d.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/main.d.ts). GLib criticals raised during a bound call are collected and reported after the call returns, and Rust entry points guard unwinding at FFI boundaries.

The relevant sources are [`runtime/src/error.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/error.ts), [`native/src/host/log_writer.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/log_writer.rs), and [`native/src/host/panic_handler.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/host/panic_handler.rs). The [Error Handling guide](/v2/guide/error-handling) explains native exceptions, promise rejections, and failures that terminate the process. React error boundaries do not catch arbitrary signal-handler exceptions or asynchronous failures.

## Native boundary audit

The native package is an implementation detail, so its interface can change whenever a smaller native primitive lets runtime own JavaScript behavior. The boundary is responsibility for ABI correctness and memory lifetime, rather than whether a function happens to contain an `unsafe` block. This audit includes the root exports, internal exports, and addon-loading helper.

### Export dispositions

| Exports                                                                  | Disposition                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`, `write`                                                          | Removed from native; runtime composes compiled field accessors.                                                                                                                                                                                     |
| `allocField`                                                             | Removed from native; runtime chooses scalar storage widths and calls `alloc`.                                                                                                                                                                       |
| `resolveType`                                                            | Removed from native; runtime resolves, invokes, and caches `get_type`. Internal codec type discovery remains a separate follow-up.                                                                                                                  |
| `getFundamentalWrapper`, `setFundamentalWrapper`                         | Removed from native; runtime owns weak identity caching over `getFundamentalIdentity`.                                                                                                                                                              |
| `onLog`                                                                  | Moved to runtime. Native `addLogListener`/`removeLogListener` fanout has a dedicated replacement plan below.                                                                                                                                        |
| `bind`, `bindFunctionPointer`, `bindVfunc`                               | Runtime now supplies callback argument order and expanded variadic counts. Signature compilation stays native; target resolution and descriptor normalization have follow-up plans.                                                                 |
| `registerClass`                                                          | Runtime supplies class flags, empty override/interface lists, and callback defaults. Native retains irreversible GType registration, size/slot checks, and permanent callback storage.                                                              |
| `init`                                                                   | Runtime owns automatic initialization. Native retains ordered environment and GLib-context installation. Scheduler policy is investigated below.                                                                                                    |
| `alloc`, `bindField`, `readField`, `writeField`, `call`, `encodePointer` | Keep native allocation, ABI access, pointer leases, and transfer transactions. Public numeric/collection/ref representation has follow-up plans.                                                                                                    |
| `copy`                                                                   | Keep native acquisition and destruction; move the Cairo path algorithm after scoped conversion support exists.                                                                                                                                      |
| `resolveFunction`, `resolveFunctionOptional`, `readFunctionPointer`      | Keep owned executable handles and checked memory access; move candidate-library selection and symbol orchestration after introducing library handles.                                                                                               |
| `getType`, `getTypeClass`                                                | Keep native instance-header access, GType validation, and class-reference ownership. Runtime already chooses wrapper classes and caches public type lookup.                                                                                         |
| `getWrapper`, `setWrapper`, `setWrapperBorrow`                           | Keep GObject toggle references, strong/weak N-API transitions, dependent borrows, and cleanup ordering. These are not equivalent to the fundamental weak cache.                                                                                     |
| `newObject`                                                              | Keep construction transaction: pending wrappers during early instance initialization, singleton reuse, temporary GValues, floating references, and callback failure cleanup. No independent policy extraction currently justifies another protocol. |
| `retainPropertyPointer`                                                  | Keep attachment ownership tied to native object replacement/finalization. A JavaScript weak map cannot provide this lifetime. A generic named attachment API would change spelling without removing the native requirement.                         |
| `getMatchInfoType`, `ownMatchInfo`, `getMatchInfoBase`                   | Keep the boxed holder that owns both match information and its subject, including copies and borrowed views. A JavaScript association cannot cover native-held copies.                                                                              |
| `keepAlive`, `quit`                                                      | Keep ref/unref and teardown of the existing native event-loop handles. Runtime already owns exit callbacks and error aggregation.                                                                                                                   |
| `armParentDeath`                                                         | Split process-selection policy from race-safe watch activation and independent monitoring; see the subprocess plan below.                                                                                                                           |
| `resolveBinding`                                                         | Already JavaScript packaging logic; keep with the addon loader, which must work without initializing runtime.                                                                                                                                       |

The retained functions have been investigated and have a specific native ownership or ABI responsibility. The remaining work packages below are planned, not implemented. Each includes the contract that must exist before deleting the current Rust behavior.

### Complete descriptor normalization

Callback defaults and class-registration defaults are now runtime-owned. Extend that approach to the remaining optional ABI metadata: public descriptors may remain concise, while the native schema receives explicit values. Use one canonical lowering path for function arguments, return values, fields, callbacks, references, nested collections, and record `abiFields`; bootstrap bindings need a dependency-safe minimal form.

Keep native validation of ABI layouts, ownership combinations, callback retention, extents, and recursion bounds. Move presentation defaults and public error formatting only after all producers use the normalized contract. Validate through the existing ABI-validation, field, callback, boxed, and collection integration suites, including descriptors nested inside records. Avoid maintaining independent defaulting rules on both sides.

Argument layout now preserves the previous fixed-prefix expansion semantics. A dedicated variadic regression should cover a callback inside that prefix; explicitly reject hidden arguments moved across the fixed/variadic boundary unless that layout receives a defined ABI contract. The current tests cover ordinary variadics and reordered callback extras separately.

### Numeric policy and collection transport

Move Number admission, integer/range checks, float32 overflow policy, and public Number/bigint conversion into runtime conversion plans. Preserve the current inclusive `-2^53..2^53` Number64 interval and float32 treatment of NaN and infinities unless making a separately documented behavior change.

This requires more than replacing `int64` with `bigint64`:

1. Native array lengths currently read Integer codecs through Number conversion. Add exact bigint/ref-bigint length extraction with checked platform-size conversion and extent validation.
2. Give direct pointer-word integers an explicit transport. Number64 hash entries currently use direct words and direct hashing; bigint values use allocated scalars, and bigint keys are rejected. Bigint pointer-list encoding also rejects negative words accepted by the integer path. Preserve these layouts before changing representations.
3. Lower nested record `abiFields`, references, callbacks, and collection elements consistently. Preserve matching typed-buffer passthrough, subview offsets, caller-visible mutation, and mismatched-view rejection.
4. Move hash-entry tuple validation and public iterable conversion to runtime. Keep native traversal, terminators, stride/extent checks, backing-store validity, ownership/destructor pairing, duplicate replacement, and partial-encoding rollback.

Contiguous C/GArray elements, pointer slots, direct pointer-word list/hash entries, and allocated bigint/floating hash values are distinct storage contracts. The normalized transport must represent those distinctions explicitly.

Existing coverage is in `numbers`, `arrays-c`, `arrays-containers`, `hashtables`, `nested-arrays`, `transfer-matrix`, and callback integration tests. Add Number64 direct-word entries, negative list words, exact bigint lengths, overflow on returned values, writes through typed-array subviews, duplicate normalized keys, asynchronous buffer retention, and late nested conversion failure under sanitizers. Remove native public Number policy only after these transports cover every direction.

### Library handles, lifecycle resolution, and binding targets

Introduce owned `openLibrary(candidate)` and `resolveSymbol(libraryHandle, symbol, optional)` primitives. Runtime chooses comma-separated candidates and caches the chosen handle. Preserve the current **first loadable library** rule: a missing symbol does not cause a search in subsequent candidates. Keep loader flags and process-wide library lifetime, and distinguish missing symbols from loading and malformed-name errors.

Resolve descriptor GTypes and copy/ref/free operations in runtime, passing native GTypes and owned function handles to codecs. This needs lazy activation: boxed type-name lookup currently sees types registered after descriptor creation. Do not eagerly resolve everything during module evaluation or permanently cache an unregistered name. Native must retain function/library owners, enforce compatible types and ref/unref pairs, and invoke destructors without depending on JavaScript execution.

Separately split signature compilation from target attachment. Runtime can then cache a lazy symbol target over a compiled signature without changing eager signature errors or lazy missing-symbol errors. Class-vfunc lookup can compose class handles and checked function-pointer reads; interface/default-interface lookup needs an owned, bounded slot primitive first. Keep vtable offset validation and class/interface references native.

Validate with type-resolution, boxed, fundamental, struct, and vfunc/interface suites. Add late type registration, missing lifecycle symbols at use, invalid ref/free pairs, handles surviving GC and shutdown, separate environments, lazy missing targets, and interface/class slot failures. Library/lifecycle handles are a prerequisite for removing native name-based codec policy.

### Non-scalar reference storage

Scalar references already use runtime-owned allocated storage. The remaining `RefCodec` path interprets non-scalar `{ value }` objects and chooses storage and replacement behavior.

Introduce an owned reference-storage handle recording the slot, seed storage, inner codec, extent/capacity, and transfer state. Runtime extracts the public value, chooses out/inout/caller-allocated mode, and decodes the result. Native retains the original owner through the call, distinguishes unchanged/null/replacement pointers, adopts or copies replacements, commits transfers once, and releases partially converted outputs. Asynchronous completion must retain the whole transaction. An untyped pointer-sized allocation followed by a read cannot replace this contract.

Build on `inout`, `callbacks`, `nested-arrays`, and runtime binding tests. Add unchanged/replaced/null slots, failing result conversion, destructor mismatch, asynchronous retention, and capacity overflow. Keep fixed byte buffers and caller-allocated containers explicit rather than inferring them from JavaScript shape.

### Log subscriptions

Replace listener-per-TSFN storage with one native sink per environment; runtime owns subscriptions and fanout. Native enqueueing assigns a sequence, and a subscription-fence operation uses the same synchronization. Subscriptions cover a sequence interval. Unsubscribe closes the interval and queues a fence marker, allowing already-enqueued records to arrive before runtime releases the callback. A sequence snapshot alone cannot release retired listeners when logging stops.

Keep native copying of borrowed GLib fields, thread-safe delivery, environment teardown, writer installation, fatal reporting, and nested synchronous critical traps. Preserve uncaught listener-exception behavior while allowing other queued subscriptions to receive their records.

Extend logging tests with emit-then-unsubscribe before yielding, subscribe-after-emit, reentrant changes, multiple producer threads, throwing listeners, collection after the last fence, worker teardown, trapped criticals, and fatal subprocess diagnostics. This work can proceed independently of descriptor changes.

### Cairo path conversion

Move the surface/context/append/copy/status-check algorithm into runtime foreign-record conversion, using ordinary Cairo bindings and deterministic cleanup. First provide a synchronous acquisition boundary that invokes conversion while native still holds the source lease and call storage. Adopt the returned owned handle into the transaction only after successful conversion.

Apply the strategy to borrowed outputs and transfer-full inputs, including callback returns. Copying a borrowed pointer after the native call scope ends would lose the current guarantee. Keep adoption, destruction, and rollback native.

Extend Cairo coverage with a source invalidated immediately after a callback, full-transfer callback paths, failed status cleanup with destructor counts, reentrant/throwing conversion, and an original value surviving failed transfer. The current Rust algorithm stays until the scoped acquisition contract passes these tests.

### Process supervision

Consolidate ancestry, process-group owner, start-time, and `/proc` policy in CLI/utils. Retain narrow native operations to arm `PR_SET_PDEATHSIG` with an immediate parent recheck, open an owned pidfd, and monitor independently of JavaScript's main loop. Recheck process identity and ancestry around watch creation/activation to close startup and PID-reuse races.

Unsupported or forbidden pidfds need an independent guard process or a dedicated worker without GTKX imports. A main-loop timer cannot monitor a blocked application. Preserve at least the existing independent SIGTERM delivery; JavaScript cleanup itself still requires main-loop progress.

Existing tests cover direct-parent death and exit signals. Add real subprocess handshakes for ancestor group-owner death while the direct parent lives, unrelated owners, wrong start times, already-dead/stopped/zombie owners, arming races, pidfd fallback, blocked main loops, and descriptor cleanup. This effort is independent of FFI descriptor work.

### Event-loop scheduling

Runtime owns bootstrap orchestration; native `init` remains ordered installation of the Node environment and GLib context. Imports must initialize through a shared runtime adapter before leaf modules create bindings. Native cleanup hooks remain essential when worker termination prevents JavaScript cleanup.

The next bounded change is a runtime-supplied dispatch budget. A larger experiment can expose scoped nonblocking dispatch, owned GLib readiness snapshots, and owned libuv poller/timer updates, then move event-mask merging, poller reconciliation, and wakeup selection into runtime. Retain GLib context ownership, snapshot memory, uv close callbacks, N-API callback/error scopes, thread confinement, and unconditional teardown.

Benchmark extra boundary crossings before adopting the full scheduler split. Add worker termination/reacquisition and competing-worker rejection, descriptor removal/reuse, unwatchable descriptors, idle/timeout behavior, JavaScript timer fairness under continuously ready GLib sources, and quit during dispatch. Existing keep-alive, quit-cleanup, exit-signal, and asynchronous callback suites remain mandatory.

After descriptor normalization, the recommended sequence is library/lifecycle handles, numeric and collection transport, owned non-scalar references, then scoped foreign-record conversion. Logging and process supervision can proceed independently. Full scheduler extraction remains contingent on the lifetime tests and performance experiment.
