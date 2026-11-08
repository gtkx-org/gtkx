---
title: "Native Ownership Boundaries"
description: "Why each GTKX native addon operation stays in Rust, and how runtime and the addon split property, numeric, library, reference, Cairo, process, and event-loop work."
---

# Native Ownership Boundaries

This page records why each part of the addon's interface stays native and what runtime keeps in TypeScript. Read [Native Runtime](/contributing/native-runtime) first; its [Native operations](/contributing/native-runtime#export-dispositions) table lists the operations these sections refer to. The rule they apply: JavaScript binding behavior belongs in runtime, and native lifetime mechanics belong in the addon.

## Properties and wrapper dependencies

Runtime keeps property names, flags, value guards, JavaScript accessors, notification policy, and class/interface registration policy. Its `GParamSpec` field offsets and layout probes remain JavaScript ABI knowledge. Probe values, class references, and default-interface references use handles with native release operations instead of paired JavaScript ref/unref calls.

Property validation uses a fresh GC-owned `GValue` for each operation. A class-level scratch `GValue` would retain its last object or boxed payload after the instance that owned the property had been collected. Metadata caches retain metadata, not the last assigned value.

Pointer-valued `GValue`s own their encoded backing storage in native handles. Property assignment and construction attach callback storage to the receiving native object. Native-managed weak-key associations keep JavaScript callback dependencies visible to V8, including callbacks that capture their owner, while native attachment ownership keeps the executable storage valid through replacement and finalization.

`setValuePointer` writes the encoded pointer and retains its backing storage together. `getObjectProperty` and `setObjectProperty` preserve these dependencies through reentrant native property calls and deferred object destruction. Replacing them with ordinary FFI calls and JavaScript retention maps would release some callback storage before native finalization finishes, so these ownership operations remain native.

Native retains candidate callback storage before entering a property setter. After the setter returns, including when it logs a GLib critical, native reads the resulting pointer of a readable property and reconciles retained storage with that value. This covers nested writes both before and after the outer setter stores its pointer. For write-only properties or getters that reenter a write, native conservatively retains candidates until a later reliable read or object finalization can release them.

Reading a callback property returns a snapshot that retains its trampoline independently of later property replacement or clearing. Constructor values remain retained through native construction, and final property reconciliation preserves the values actually stored after reentrant replacements or clearing.

Library overrides can identify a borrowed relationship that needs protection. The Window override supplies the native default-widget setter to `setWrapperBorrow`; native retains the dependent wrapper, leases both objects during cleanup, and clears the pointer directly before deferred wrapper teardown. The override neither keeps its own retention map nor constructs a JavaScript wrapper to perform cleanup.

Library compatibility workarounds remain in overrides. Sidebar detaches retired models and explicitly disposes detached rows, because libadwaita leaves views retired by a mode change connected to their models. ComboRow disconnects the native handlers its default factory and item boxes hold, because libadwaita does not tie them to the row's lifetime. TabBar disposes its tab boxes when it is destroyed, because libadwaita's boxes keep a plain pointer to the bar and the tabs they drop still follow their pages. Emission hooks on Breakpoint's `apply` and `unapply` signals pass each breakpoint bin holding a window's focus to `deferFinalization` with the focused widget, because libadwaita's bins register a weak pointer on that widget at every breakpoint change and never clear it. The hooks reach the internal bins of windows and dialogs, which have no wrapper. These workarounds are permanent. These calls change library behavior and are distinct from balancing references on runtime-owned handles.

## Descriptor normalization

Runtime owns callback and class-registration defaults, storage flags, reference direction, and array element ownership. Public descriptors remain concise, while the native schema requires explicit values. Function arguments, return values, fields, callbacks, references, nested collections, and record `abiFields` share the runtime conversion plans. Bootstrap scalar bindings already supply complete descriptors; enum lookup lowers its pointer and string descriptors when invoked, avoiding module-initialization cycles.

Native retains validation of ABI layouts, ownership combinations, callback retention, extents, and recursion bounds, without duplicating descriptor defaults. Runtime rejects cyclic descriptors before recursive lowering.

## Numeric policy and collection transport

Runtime validates JavaScript numbers, checks public integer ranges and finite float32 overflow, and converts between number and bigint. Number64 accepts the inclusive `-2^53..2^53` interval. Float32 accepts NaN and infinities. Native validates that normalized values fit their ABI storage.

Native 64-bit integer descriptors carry bigint values and an explicit `isDirectWord` flag. Runtime sets it for public Number64 descriptors, preserving direct hashing and signed pointer-word list entries. Ordinary bigint hash values use allocated scalars. Bigint keys are unsupported, and ordinary bigint pointer lists require nonnegative words. Contiguous C/GArray storage and matching typed-buffer passthrough remain distinct from pointer collections. Typed-array offsets and writes are preserved; incompatible views are rejected.

Array lengths are extracted exactly from integer and bigint arguments or references, then checked against platform sizes and native extents. Runtime validates hash-entry tuples and converts iterables before native allocation. Native retains traversal, terminators, stride/extent checks, backing-store validity, ownership/destructor pairing, duplicate replacement, and partial-encoding rollback. Nested records, references, callbacks, and collection elements use the same runtime conversion plans.

## Library handles, lifecycle resolution, and binding targets

Native [`ffi/library_cache.rs`](https://github.com/gtkx-org/gtkx/blob/main/packages/native/src/ffi/library_cache.rs) provides owned `openLibrary(candidate)` and `resolveSymbol(libraryHandle, symbol, optional)` primitives. [`runtime/src/native-bindings.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/native-bindings.ts) chooses among comma-separated candidates and caches the chosen handle. Resolution uses the **first loadable library**: a missing symbol does not cause a search in subsequent candidates. Native retains the loader flags and process-wide library lifetime. Optional resolution suppresses only missing symbols; loading and malformed-name errors propagate.

Runtime supplies lazy functions for descriptor GTypes and copy/ref/free operations through [`descriptor-lifecycle.ts`](https://github.com/gtkx-org/gtkx/blob/main/packages/runtime/src/descriptor-lifecycle.ts). Native retains those functions directly from the descriptor and activates them at the codec's acquisition boundary, including during output or callback decoding, so types registered after descriptor creation or by the callee remain visible. Successful resolutions are cached; unregistered names and failed function lookups remain retryable. Native validates types, ref/unref pairs, and reusable library-backed function handles. Resolved destruction operations come from permanently loaded libraries and run as native function pointers, so they remain callable after their JavaScript wrappers or environment are released. Resolver callbacks belong to their Node environment and are released during its teardown. Foreign-record conversion strategies resolve native operations at the same acquisition boundary.

`bindFunction` accepts compiled argument and return descriptors and compiles a signature independently of its target. Runtime retains that signature and lazily caches the executable handle, passing both to native `call`. Compatible signatures also create callback trampolines through `createFunction`; nested callback descriptors reference a compiled signature instead of rebuilding their call interface for each callback instance. Native validates the signature's calling convention for its use, including variadic arguments and hidden callback error outputs. Descriptor compilation validates value layout; signature binding separately validates whether those values support calls or callbacks.

Native checks the target's borrow lifetime and acquires its lease on each invocation, consuming one-shot targets before calling them. Runtime validates vfunc offsets and lazily acquires a bounded class, implemented-interface, or default-interface handle through `getTypeClass`. It reads the executable target with `readField`, which checks the field extent and retains the owning vtable. Empty implementations fail when resolved. Class and interface references are released when no dependent handle remains.

## Non-scalar reference storage

Runtime requests storage for scalar references; native code owns the allocation. Non-scalar reference descriptors compile recursively through `compileDescriptor` and are retained by the call signature. Calls accept ordinary normalized `{ value }` cells, with storage derived from the descriptor and seed. Runtime supplies owned `alloc` handles for caller-allocated C arrays. Native validates their bounds and retains the owner; GLib containers still require their native container layout and lifecycle.

Native `call` accepts an argument array or an `(index) => value` producer. Runtime uses the producer so native can capture each converted reference seed and acquire its native owners before the next conversion can reenter JavaScript or trigger collection. ABI storage is prepared only after every argument has been normalized, so later conversions cannot invalidate an already-prepared typed-array pointer. Each invocation owns its temporary transaction; cells can be reused without exposing a separate storage handle or mode enum.

Native preserves synchronous typed-array views, checks returned extents against remaining capacity, distinguishes unchanged/null/replacement pointers, adopts or copies replacements, and settles transfers. Output decoding visits remaining outputs even after an earlier conversion fails, so their native allocations are released. Runtime updates public reference cells after decoding their results.

Asynchronous non-scalar references must borrow the output and its elements: the synchronous result API cannot release transferred outputs before completion. Native rejects incompatible transfer contracts before calling C and retains borrowed reference transactions, including independent buffer copies and native owners, until completion.

Callback references exchange normalized values through ordinary JavaScript cells. Runtime exposes the public reference object and converts its replacement; native writes each ABI output and retains its acquired storage. The cell carries JavaScript values rather than access to caller-owned ABI memory. Native handles borrowed by those values still expire with the invocation. Output writes are sequential.

## Cairo path conversion

Runtime selects the Cairo path conversion strategy and includes its options and lazy operation resolvers in the struct descriptor. `compileDescriptor` snapshots those options with the value codec; there is no separate converter factory or opaque converter handle. Native creates a temporary surface and context, appends and copies the source path, checks status, and releases temporary resources through Rust-owned scopes.

Native validates that the result uses the declared path destructor and transfers the copied allocation into the pending ownership transaction. Borrowed outputs and transfer-full inputs, including callback returns, share this acquisition boundary. Failure cleanup preserves the original source.

## Process supervision

The CLI supervises its application runner, forwards shutdown signals, and forces termination if shutdown times out. The runner exits when its IPC connection to the CLI closes. [Native UI integration](/contributing/testing#native-ui-integration) covers how headless sessions are released and reclaimed.

## Event-loop scheduling

Runtime controls initialization order and supplies the dispatch budget, as [GLib inside Node's event loop](/contributing/native-runtime#glib-inside-node-s-event-loop) describes. Native validates the budget before initialization and retains GLib context ownership, readiness storage, libuv handle reconciliation and close callbacks, N-API callback/error scopes, thread confinement, and unconditional teardown. Its cleanup hooks still run when worker termination prevents JavaScript cleanup.

The [scheduler benchmark](https://github.com/gtkx-org/gtkx/blob/main/packages/native/tools/scheduler-benchmark.ts) compares native scheduling with a copied readiness snapshot and a JavaScript callback per cycle. Run `node packages/native/tools/scheduler-benchmark.ts` from the repository root. It measures per-cycle copy and callback overhead. Use application-level latency measurements as well when evaluating changes to the scheduling boundary.

Verify ownership and callback changes through the [native fixtures and sanitizers](/contributing/testing#native-fixtures-and-sanitizers). Runtime process tests cover startup, shutdown, worker isolation, and logging; generated-binding integration tests exercise value conversion and native lifetimes.
