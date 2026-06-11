# TODO: Adopt gtk-rs higher-level abstractions in `@gtkx/native`

Findings from a multi-agent audit of `packages/native` (June 2026). Every finding was adversarially
verified against the vendored crate sources for the pinned versions — glib 0.22.7, gtk4 0.11.3,
gio 0.22.6 — checking that the proposed API exists, is not feature-gated beyond `v2_68`, preserves
refcount/ownership/threading semantics, and adds no cost on the benchmarked marshalling hot path.

Standing constraints that shaped (and reject some of) these findings:

1. The dynamic, JS-data-driven call path cannot be replaced by static gtk-rs bindings — signatures
   arrive from JavaScript at runtime. Only infrastructure and helpers around it are in scope.
2. Every GTK/GLib call runs on the dedicated GLib thread; proposals must stay mailbox-compatible.
3. The marshalling hot path is CodSpeed-benchmarked and near-allocation-free.
4. ASan and Miri run over the marshalling path; replacements must be behaviorally identical
   (refcount semantics, ownership transfer, floating refs).

Verdict legend: **confirmed** = adopt as written; **partial** = adopt with the listed revisions.

---

## 1. Swaps that also fix real defects

- [x] **Replace the legacy default log handler with `glib::log_set_writer_func`** — confirmed
  - `src/glib_log_handler.rs:19-44`
  - Now: `glib::log_set_default_handler(Self::handle_log)`, hand-formatted levels, manual
    `log_writer_default_would_drop` check, stderr write, Error/Critical forwarded to
    `NativeErrorReporter`.
  - Change: `glib::log_set_writer_func` (glib `src/log.rs:454`) with a
    `Fn(LogLevel, &[LogField<'_>]) -> LogWriterOutput` closure. Extract `MESSAGE` / `GLIB_DOMAIN`
    via `LogField::key` / `value_str`, forward Error/Critical to the reporter, delegate to
    `glib::log_writer_default` (applies would-drop filtering and journald/stderr selection).
  - Why: empirically verified on GLib 2.88.1 / GTK 4.22.4 — `g_log_structured` messages never reach
    a handler installed with the legacy API, and libgtk-4 imports `g_log_structured`, so part of
    GTK's own logging is currently invisible to the handler and to the JS error reporter. A writer
    func captures legacy logs, structured logs, and GTK criticals.
  - Risk: the writer can be set only once per process — the gtk-rs wrapper panics on a second call
    — so `install` needs a `OnceLock` guard like `install_panic_hook`. The trampoline's
    `LogLevel::from_glib` panics on custom levels with no standard bit; the current handler has the
    identical exposure, so this is not a regression.

- [x] **Filter dynamically resolved GTypes through `glib::Type::is_valid`** — confirmed
  - `src/types/boxed.rs:111-132`
  - Now: `try_resolve_gtype_from_library` wraps the raw symbol result unconditionally; a `get_type`
    symbol returning 0 yields `Some(Type::INVALID)`, which `gtype()` feeds into
    `g_boxed_copy`/`g_boxed_free` — undefined behavior in GObject.
  - Change: `Ok(Some(gtype).filter(|t| t.is_valid()))` (glib `src/types.rs:271`), mirroring the
    `.filter(|t| t.is_valid())` that `glib::Type::from_name` already applies on the primary path.
  - Why: a mismatched `getTypeFn` degrades to the explicit "Cannot copy boxed type" error path
    instead of UB. One register comparison once per type resolution; no hot-path cost.

- [x] **Replace raw `GEnumClass` plumbing in `validate_enum_value` with `glib::EnumClass`** — confirmed
  - `src/types/numeric.rs:406-426`
  - Now: manual `g_type_class_ref` cast to `*mut GEnumClass`, null check, `g_enum_get_value(...)
    .is_null()`, manual `g_type_class_unref`.
  - Change: `glib::EnumClass::with_type(gtype)` (glib `src/enums.rs:80`) +
    `EnumClass::value(value).is_none()`; Drop releases the class reference.
  - Why: removes all hand-rolled class refcounting, and `with_type` verifies
    `g_type_is_a(type, G_TYPE_ENUM)` before deref — the raw code would feed a flags or object GType
    straight into `g_enum_get_value`. `cfg(debug_assertions)`-only path, off the hot path.

- [x] **Fix O(n²) GList construction with `g_list_prepend` over a reversed iterator** — side
  finding from a rejected proposal (see Not viable)
  - `src/types/array.rs:297-304` (`encode_strings`) and `src/types/array.rs:324-331`
    (`encode_handles`)
  - Now: `g_list_append` in a loop walks to the tail each iteration — O(n²).
  - Change: `glib::ffi::g_list_prepend` over `iter().rev()` — the exact pattern `GSListEncoder`
    already uses at lines 355-361 and glib's own `ToGlibContainerFromSlice` impl uses internally.
  - Why: O(n) construction with zero changes to ownership flags, NULL handling, error paths, or
    per-call allocations. The higher-level trait itself was rejected (storage lifetime mismatch);
    this local fix is what survives.

## 2. Hot-path wins: one allocation instead of two per transfer-full string

All three sites currently copy every string twice: `CString::new` then `g_strdup`.
`glib::translate::ToGlibPtr::<*mut c_char>::to_glib_full()` on `&str` (glib
`src/translate.rs:588-601`) performs a single `g_strndup` with an identical g_malloc-owned result.
Required amendment everywhere: keep an explicit interior-NUL pre-check (the same memchr scan
`CString::new` performs today, so no new cost) so JS strings containing U+0000 surface the current
error instead of glib's debug-assert / release-mode silent truncation.

- [x] **`src/types/string.rs:33-104`** — partial (adopt with the NUL pre-check)
  - The three transfer-full sites: `encode`'s `Ownership::is_full` branch (line 36),
    `write_return_to_raw_ptr` (lines 81-85, write NULL on NUL failure as today), and
    `write_value_to_raw_ptr` (lines 94-95, bail with the current anyhow error).
  - The transfer-none encode branch keeps its `CString`: `FfiStorageKind::CString` owns the buffer
    for the call's duration.

- [x] **`src/types/hashtable.rs:77-84`** — confirmed
  - `HashTableEntryEncoder::encode`'s String arm. The single `g_strndup` allocation remains
    compatible with the `Some(glib::ffi::g_free)` free func installed by `g_hash_table_new_full`;
    mirrors glib's own `HashMap<String, String>` `ToGlibPtr` impl (`translate.rs:1298`). The dynamic
    table construction and the `GHashTableIter` decode loop have no glib-rs equivalent at 0.22.7
    and correctly stay raw.

- [x] **`src/types/array.rs:720-732`** — partial (restructure, not a one-line swap)
  - `append_items_to_garray` must iterate `array` directly and match `value::Value::String(s)` —
    `Self::extract_strings` is what creates the CStrings, so swapping only the `g_strdup` call
    changes nothing. Bail on interior NUL with the same error path, then `to_glib_full(s.as_str())`.
  - Extending the collapse to the dup branches at lines 246, 300, 357 requires changing the
    `ArrayKindEncoder::encode_strings` signature (lines 218-223) and its call site (line 572),
    because the non-dup path stores `Vec<CString>` in FfiStorage to keep borrowed pointers alive.

## 3. Dependency removal

- [x] **Replace `send_wrapper` with `glib::thread_guard::ThreadGuard`** — confirmed
  - `src/managed.rs:43-170`; drop `send_wrapper = "0.6"` from `Cargo.toml` (used nowhere else).
  - Change: `ThreadGuard<NativeValue>` (public module, glib `src/lib.rs:254`); `wrapper.valid()`
    becomes `wrapper.is_owner()`; `NativeHandle::clone` becomes
    `self.inner.as_ref().map(|g| ThreadGuard::new(g.get_ref().clone()))` — `get_ref()` asserts the
    owning thread exactly like `SendWrapper`'s deref, preserving the documented
    panic-when-cloned-off-thread contract (lines 85-99).
  - Semantics identical at the pinned version: `Send` for non-Send payloads, panic on cross-thread
    access and drop, `ManuallyDrop` storage so the shutdown-path `std::mem::forget` leaks the
    payload exactly as today. `ThreadGuard` is unconditionally `Sync` where `SendWrapper` is not,
    but the field is private so no new aliasing is exposed. No hot-path impact.

## 4. GByteArray: converge on `glib::ByteArray`

- [x] **Storage: replace the pointer + flag pair with `Option<glib::ByteArray>`** — partial
  - `src/ffi/storage.rs:50-53, 238-242`
  - Now: `GByteArrayData { array_ptr: *mut GByteArray, should_free: bool }` with a hand-rolled
    Drop arm calling `g_byte_array_unref`.
  - Change: store `Some(unsafe { from_glib_full(ba) })` when `ownership.is_borrowed()` and `None`
    when the callee takes the ref; keep capturing the raw pointer for the libffi slot (or via
    `ByteArray::as_ptr()`). Drop the FfiStorage Drop arm and the `should_free` field.
  - Revision: do NOT also switch construction to `glib::ByteArray::from(&bytes[..])` — `From`
    always returns an owned wrapper whose drop unrefs, so the transfer arm would free an array the
    callee owns unless leaked via `IntoGlibPtr::into_glib_ptr`, and `From` uses un-pre-sized
    `g_byte_array_new`. The wrapper is `!Send` but lives entirely within one `execute` call on the
    GLib thread.

- [x] **Encode: RAII ownership around the existing sized construction** — confirmed
  - `src/types/array.rs:604-633`
  - Keep `g_byte_array_sized_new` + `g_byte_array_append` (pre-sized; the `From<&[u8]>` constructor
    is not), then wrap conditionally per the storage finding above. Refcount release becomes RAII
    with semantics identical to the current `g_byte_array_unref` path.

- [x] **Decode: wrap and read through `Deref<Target = [u8]>`** — partial
  - `src/types/array.rs:904-928` (`decode_gbytearray`)
  - Keep the `as_non_null_ptr` early return, then branch on
    `self.ownership.is_full() && !matches!(ffi_value, ffi::FfiValue::Storage(_))`: when true,
    `from_glib_full` (Drop performs the one unref done manually today); when false,
    `from_glib_borrow` — NOT `from_glib_none`, which would add a refcount round-trip on the
    benchmarked decode path. `FfiStorage::drop` remains the sole owner-side unref. Note glib's
    Deref debug-asserts on `data == NULL` with `len > 0` where the current code returns empty.

## 5. Type-system and refcount hygiene (mechanical, zero-cost)

- [x] **`src/toggle_ref.rs:108-142` — typed Quark** — confirmed
  - `glib::Quark::from_static_str(glib::gstr!("gtkx-wrapper-ref"))` (glib `src/quark.rs:21`,
    `gstr!` at `gstring.rs:425`). Keep the cache as `OnceLock<glib::Quark>` — `wrapper_quark()` is
    reached from `binding_ptr` behind `has_wrapper` on the per-object decode path, and the
    OnceLock-retaining variant is the strictly zero-cost one (dropping it would swap one atomic
    load for GLib's locked quark-table hash lookup). Remaining raw qdata calls take
    `quark.into_glib()`.

- [x] **`src/toggle_ref.rs:153-160` — `is_gobject` via `glib::types::instance_of`** — confirmed
  - `unsafe { glib::types::instance_of::<glib::Object>(instance.cast()) }` (glib
    `src/types.rs:580`) expands to exactly the current
    `g_type_check_instance_is_a(ptr, g_object_get_type())` sequence; glib uses this same helper in
    its own wrapper-macro debug asserts. Same `unsafe fn` preconditions, identical machine code.

- [x] **`src/types/gobject.rs:56-62` — floating-type check via `Type::is_a`** — confirmed
  - Lift the loaded `g_type` with `from_glib`, then
    `gtype.is_a(glib::InitiallyUnowned::static_type())` — the exact pattern glib uses internally
    (`object.rs:1530`). The `g_object_is_floating` call on line 62 must stay raw: glib 0.22.7 has
    no safe wrapper for it (verified by grep over the whole crate). `#[inline]` zero-cost on the
    decode hot path.

- [x] **`src/module/register_class.rs:236-242` — duplicate-name probe via `Type::from_name`** — confirmed
  - `if glib::Type::from_name(&self.name).is_some() { anyhow::bail!(...) }` replaces the raw call
    and the `!= 0` sentinel. Pairs with the GString finding below so `&GString: IntoGStr` passes
    the existing nul-terminated buffer with zero copies.

- [x] **`src/module/register_class.rs:477-478` (also 16, 223, 236-241, 374) — type name as
  `glib::GString` instead of `CString`** — confirmed
  - `glib::GString::from_string_checked` (`gstring.rs:1266`) gives the same interior-nul validation
    with the same `InvalidArg` mapping; `GString::as_ptr` feeds the residual
    `g_type_register_static`; Display replaces `to_string_lossy` on a string that is known-valid
    UTF-8 from JS. One-time registration path. Main value is enabling the `Type::from_name`
    findings; on its own the gain is modest.

- [x] **`src/module/register_class.rs:222-249` (also 46-48, 163-166, 199-205, 310-345, 357-381) —
  carry GTypes as `glib::types::Type` through the request structs** — partial
  - Type the fields (`RegisterClassRequest::parent_gtype`, `RawInterface::gtype`,
    `PreparedInterface::gtype`) as `glib::types::Type`, aliased to avoid colliding with the file's
    `crate::types::Type` import (line 28). Convert at the napi boundary with
    `from_glib(value as glib::ffi::GType)` (lines 119, 482); replace the `== 0` sentinels (lines
    232, 246, 292, 334) with `!t.is_valid()`; pass `into_glib()` to the residual raw
    `g_type_query` / `g_type_register_static` / `g_type_interface_peek` calls (no glib-rs wrappers
    exist for those); return `new_gtype.into_glib() as u64` at line 381.
  - Revision: do NOT print `glib::Type::name()` (or Debug/Display, which delegate to it) in the
    interface-mismatch report at lines 201-204 — `Type::name` performs an unchecked `CStr::from_ptr`
    on `g_type_name`, which returns NULL for unregistered nonzero ids, the exact JS-garbage input
    that error branch exists to report. Keep formatting the numeric id.

- [x] **`src/state.rs:109-127` — `Type::from_name` fast path + cache in
  `LibraryCache::resolve_gtype`** — confirmed
  - *Resolution:* the `(lib_name, get_type_fn_name)`-keyed cache is adopted, removing the repeated
    dlsym + raw call from debug-only enum validation. The `Type::from_name` fast path is deferred:
    it requires the tagged-type descriptor to carry the GIR type name, which touches JS-side
    codegen for a path the cache already collapses to one resolution per descriptor.
  - First try `glib::Type::from_name` (wraps `g_type_from_name`), falling back to the existing
    dlsym path for first-touch resolution of unregistered types — the hybrid
    `BoxedType::gtype` already implements at `src/types/boxed.rs:67-77`. Requires the descriptor
    (`src/types/numeric.rs:380-404` carries only `library` and `getTypeFn`) to also carry the GIR
    type name, which touches JS-side codegen. Independently, cache the resolved `Type` (Copy) in
    `LibraryCache` keyed by `(lib_name, get_type_fn_name)`, mirroring `FundamentalFnCache`.
  - The affected caller is debug-only enum validation, which currently repeats the dlsym + raw
    call for every validated enum value; the benchmarked path is untouched.

- [x] **`src/types/gobject.rs:153-168` — field-slot strong-ref swap via Option-level translate
  impls** — partial
  - Route BOTH pointers through the `Option` impls so null is absorbed on both sides (JS writes
    null to clear a field — `value.rs:236` maps Null/Undefined to a null pointer, and the
    non-Option forms would hit debug asserts / UB):
    `let owned_new = unsafe { Option::<glib::Object>::from_glib_borrow(new_ptr.cast()) }.to_glib_full();`
    (yields null for None, plain `g_object_ref` with no sink for Some), write the slot unaligned as
    today, then `drop(unsafe { Option::<glib::Object>::from_glib_full(old_ptr.cast()) })` —
    absorbs the old-pointer null check and unrefs via `ObjectRef::drop`. Preserve the statement
    order (acquire new, write slot, release old). The unaligned slot accesses stay raw — glib has
    no unaligned pointer-slot abstraction. Zero allocations; `Option<Object>` is niche-optimized
    to pointer size.

- [x] **`src/types/boolean.rs:10-38` — gboolean encode via `IntoGlib`** — partial
  - Safe encode/write directions only: line 14 `ffi::FfiValue::I32(boolean.into_glib())`, line 57
    `*(ret as *mut i32) = val.into_glib()`, line 64 `*(ptr as *mut i32) = (*b).into_glib()`.
  - Revision: keep the safe `!= 0` comparisons for decode (lines 34, 43, 52) — `FromGlib::from_glib`
    is an `unsafe fn` and would introduce new `unsafe` blocks into the Miri/ASan-audited path.
    `libffi::Type::i32()` at line 18 remains the sole width authority. Both impls are `#[inline]`
    bodies compiling to identical machine code.

- [x] **`src/types/ref_type.rs:242-265` and `src/types/string.rs:54-68` — C-string reads via
  `glib::GStr::from_ptr_lossy`** — partial
  - Replace `CStr::from_ptr(p)` + `to_string_lossy().into_owned()` with
    `unsafe { glib::GStr::from_ptr_lossy(p) }.to_string()` in both branches of `decode_ref_string`
    and the identical sibling `StringType::decode`; RETAIN the explicit
    `if ownership.is_full() { g_free(...) }`.
  - Revision: do NOT use `from_glib_full::<GString>` (panics on the `gstring.rs:2079` debug assert
    in debug builds; yields an invariant-violating String via `from_utf8_unchecked` in release on
    non-UTF-8 input) or `GStr::from_ptr_checked` (replaces substitution with None).
  - Accepted semantic delta: on malformed input, `g_utf8_make_valid`'s U+FFFD substitution
    granularity may differ from Rust's `to_string_lossy` (both outputs are valid UTF-8). If
    byte-identical lossy output is a requirement, no gtk-rs string API satisfies it and the current
    form should stay.

- [x] **`src/module/test_support.rs:36-60` — weak-ref notify via
  `ObjectExt::add_weak_ref_notify`** — confirmed
  - Obtain the object with `from_glib_borrow::<_, glib::Object>` — NOT `from_glib_none`, whose
    ref/unref pair would fire toggle notifies on a toggle-referenced wrapper and perturb the exact
    accounting the tests assert — then
    `add_weak_ref_notify(|| { FINALIZE_COUNT.fetch_add(1, Ordering::SeqCst); })`. Drop the returned
    `WeakRefNotify` handle: it has no Drop disconnect, so the notify stays installed exactly like
    the current set-and-forget `g_object_weak_ref`. Deletes a hand-written C ABI trampoline.
    Test-only path; the closure boxing is acceptable there.

- [ ] **`src/module/test_support.rs:88-99` — toggle ref/unref pair through `glib::Object`** —
  partial, optional
  - *Decision (2026-06-11):* skipped, taking the item's own out — the test's doc comment
    deliberately describes the explicit ref/unref pair this race test exercises, so the raw calls
    stay.
  - Borrow-then-clone compiles to exactly `g_object_ref` then `g_object_unref` with no sink:
    `let object = unsafe { glib::Object::from_glib_borrow(addr.cast()) }; drop(object.clone());`
  - Revision: do NOT use `from_glib_none` — it calls `g_object_ref_sink`, whose floating-ref
    semantics differ from the raw pair this race test exercises. Since the test's doc comment
    deliberately describes the explicit pair, keeping the raw calls is also a defensible outcome.

- [ ] **`src/toggle_ref.rs:307-310` — express `install`'s pending-reference release through
  translate traits** — confirmed, low confidence; weigh legibility
  - *Decision (2026-06-11):* skipped on the item's own caution — the release point is
    ordering-critical against the qdata writes and a synchronous toggle notify, and the raw
    `g_object_unref` states that more legibly than a scoped drop of a translate wrapper.
  - The trailing release only:
    `drop(unsafe { <glib::Object as FromGlibPtrFull<_>>::from_glib_full(gobject) })` — Drop
    performs exactly one `g_object_unref`, matching line 310 and mirroring the pattern already used
    in `src/types/gobject.rs:104-108`. The rebind-branch `g_object_ref` at line 307 must stay raw:
    `from_glib_none` is NOT a substitute because it calls `g_object_ref_sink` and a still-floating
    object legitimately carries a wrapper here.
  - Caution: the drop must occur at exactly the current line-310 point — the unref can
    synchronously fire `on_toggle_notify` (is_last_ref) and block on a JS-thread roundtrip;
    misplaced RAII scope would reorder that against the qdata writes.

- [ ] **`src/types/gobject.rs:64-77` — pending-reference normalization through translate traits** —
  confirmed, low confidence; weigh legibility
  - *Decision (2026-06-11):* skipped on the item's own caution — the block implements the
    deliberate leak-for-later-adopter protocol, and a discarded `.into_glib_ptr()` is less legible
    than the raw `g_object_ref_sink` it would replace.
  - Arm-for-arm equivalents: releasing a pending full-transfer ref becomes
    `drop(from_glib_full(ptr))` (non-floating) / `drop(from_glib_none(ptr))` (floating;
    `from_glib_none` is `g_object_ref_sink`); the fresh-bind sink arm becomes
    `from_glib_none(ptr).into_glib_ptr()`; the borrow arm's never-sink fresh reference becomes
    `from_glib_borrow(ptr).to_glib_full()` (plain `g_object_ref`, no sink).
  - Caution: this block implements the deliberate leak-for-later-adopter protocol that
    `toggle_ref::install` consumes — a discarded `.into_glib_ptr()` is arguably less legible than
    the raw `ref_sink` it replaces. The `is_floating`/`is_initially_unowned` guards must be kept
    verbatim (`from_glib_none` sinks unconditionally), and `from_glib_*` debug-asserts
    `ref_count != 0`.

## 6. Signal dispatch through `glib::Closure` (largest item — a rewrite of the signal path)

- [x] **Add a dedicated native connect primitive on `ObjectExt::connect_local_id` /
  `RustClosure`** — partial
  - `src/trampoline.rs:75-253` and `src/types/trampoline.rs:103-170`; consumer is
    `packages/ffi/src/signals.ts:80-90` (the `GCallback` of a dynamic `g_signal_connect_data`).
  - Now: every JS signal connection builds a libffi executable closure over a self-referential
    `ManuallyDrop<Box<TrampolineData>>`, reads raw ABI argument slots by hand using arg-type
    descriptors from JS codegen, writes the JS return into the raw result slot, and hand-manages
    callback lifetime per GIR scope — a hand-written `GDestroyNotify` (`Notified`), a self-freeing
    `AtomicPtr` handshake (`Async`), and an unconditional leak (`Forever`).
  - Change: a native connect primitive for the signal consumer only. GLib's marshaller delivers
    each parameter as a typed `glib::Value`; the handler converts by `Value::type_()` dispatch to
    the JS IR. Ownership of the captured `Arc<JsRef<JsFunction>>` moves into the GClosure via its
    finalize notifier, so disconnect or emitter finalization drops it automatically —
    `JsRef::drop` already schedules the napi-ref release onto the JS thread. Deletes the destroy
    trampoline and the `AtomicPtr` handshake for the signal path.
  - Required corrections from verification:
    1. Resolve signals via `glib::subclass::SignalId::parse_name` (`src/subclass/signal.rs:191`,
       force_detail=true) and connect with `connect_local_id` / `connect_closure_id` —
       `glib::signal::SignalId` does not exist (`glib::signal` holds only `SignalHandlerId`), and
       unknown signals must surface as JS errors since glib's wrappers panic inside an
       `extern "C"` marshal (hence abort).
    2. Preserve the never-panic error contract: query the return type once at connect time via
       `SignalId::query()`; on any JS callback error, report through `NativeErrorReporter` and
       return `glib::Value::from_type(return_type)` for value-returning signals (None for void) —
       glib's marshal panics on a missing or mistyped return.
    3. Pair the right types: `connect_closure` takes `RustClosure` (`RustClosure::new_local`,
       `closure.rs:74`); `Closure::new_local` alone cannot be passed to it.
    4. Keep GValue→IR conversion for pointer-typed inout out-params (e.g.
       `GtkEditable::insert-text`'s position, extracted as `G_TYPE_POINTER` and flushed through
       the existing `write_value_to_raw_ptr` path).
  - The libffi trampoline MUST remain for Call/Async/Forever callback scopes and register_class
    vfuncs. Threading fits: creation, emission, disconnect, and finalization all occur on the GLib
    thread, satisfying the `ThreadGuard` asserts inside `new_local`.

- [ ] **`src/toggle_ref.rs:169-175, 288-292, 370-374` — WrapperBinding qdata via `ObjectExt`
  qdata APIs** — partial, marginal gain; consider skipping
  - *Decision (2026-06-11):* skipped per the item's own assessment — one of five strong-count
    sites eliminated at the cost of an extra `Box` per bind does not pay for revalidating the
    teardown ordering invariant.
  - `set_qdata::<Arc<WrapperBinding>>` / `qdata` / `steal_qdata` through a refcount-neutral
    `Borrowed<glib::Object>` from `from_glib_borrow`; teardown's clear-then-drop pair becomes a
    single `steal_qdata` (GLib fires no destroy notify on steal) dropped at the exact point of
    today's `decrement_strong_count`, preserving the clear-slot → delete-napi_ref →
    remove-toggle-ref order.
  - Revised accounting: the qdata slot holds `Box<Arc<WrapperBinding>>`, so in `install`'s
    fresh-bind path capture `Arc::as_ptr` and the finalizer count BEFORE handing the Arc to
    `set_qdata`; all finalizer-side strong-count sites remain — only the `into_raw` at 287 and the
    slot-owned decrement at 374 are eliminated (one of five strong-count sites). `binding_ptr`
    becomes `qdata` + `Arc::as_ptr` on the pointee. The null/`is_gobject` guards stay ahead of
    `from_glib_borrow`. Cost: one extra `Box` per bind on the wrapper-bind path.

## 7. String-array marshalling via `glib::StrV` and typed lists

- [x] **Decode NULL-terminated string arrays with `StrV` / `StrVRef`** — partial
  - `src/types/array.rs:951-975`
  - Mapping by runtime ownership flags: full+item-full →
    `StrV::from_glib_full` (frees array and strings on drop, identical to `g_strfreev`);
    full+item-borrowed → `StrV::from_glib_container` (net effect matches the current g_free-only
    branch); borrowed → `StrV::from_glib_borrow` for a plain `&[GStringPtr]`
    (`StrVRef::from_glib_borrow` returns `&StrVRef`, which derefs to the same slice).
  - Revisions: element conversion MUST use `glib::GStr::from_ptr_lossy(item.as_ptr())` — never
    `GStringPtr::as_str`, which is `from_utf8_unchecked` and UB on invalid UTF-8. Two recorded
    risks: `g_utf8_make_valid`'s U+FFFD granularity can differ from Rust's `to_string_lossy`
    byte-for-byte on malformed input, and the full/borrow paths gain one O(n) length pre-walk
    versus the current single fused walk (no allocation; the path is benchmarked).

- [x] **Build NULL-terminated string argument arrays with `StrV`** — partial
  - `src/types/array.rs:236-261` (`NullTerminatedArrayEncoder::encode_strings`)
  - Revisions: (1) build elements with `glib::GString::from_string_checked(s.clone())` mapped into
    the existing anyhow error — `GString::from(&str)` panics in debug and silently truncates at
    interior NUL in release, while the current `CString::new(...)?` errors; collect via
    `FromIterator<GString>`. (2) Keep three arms keyed on (container ownership, dup_elements):
    borrowed+borrowed → store a new `FfiStorageKind::StrV(glib::StrV)` variant and pass
    `strv.as_ptr()` (guaranteed NULL-terminated); full+full → `strv.into_raw()` with no storage
    retention; borrowed container + full elements → retain today's per-element `g_strdup` path.
    (3) `decode_storage`'s `ItemCodec::String` arm reads `as_cstring_array`
    (`storage.rs:146-151`), so the StrV variant needs an equivalent accessor built on
    `StrV::as_slice()`.

- [ ] **Model duplicated string GList/GSList storage as `glib::collections::List<GStringPtr>` /
  `SList<GStringPtr>`** — partial, low confidence
  - *Decision (2026-06-11):* skipped — low confidence per the audit, and the `GStringPtr::from`
    truncation hazard means the typed-list construction cannot reuse the validated single-allocation
    path the encoders now share; the `should_free`/`elements_duped` flags it would remove are now
    documented on the storage structs.
  - `src/ffi/storage.rs:28-41, 174-213`
  - For the `elements_duped == true` arm only. Revisions: (1) build each `GStringPtr` from the
    already-validated CString (`GStringPtr::from` uses `g_strndup` and would silently truncate
    interior NULs the current path rejects). (2) Transfer-full: `into_glib_ptr` immediately after
    `FromIterator` construction, storing only the leaked head pointer — reproducing current
    behavior exactly, including the leak when symbol resolution fails between encoding and the
    call; borrowed: store the owned List/SList (head via `as_ptr()` for the libffi slot) and let
    Drop perform the `g_(s)list_free_full(.., g_free)` equivalent. This removes both the
    `should_free` and `elements_duped` flags from the new representation. (3) The O(n²)→O(n) win
    applies only to the GList encoder (see §1). `!Send` is fine: FfiStorage lives entirely within
    `ModuleRequest::execute()` on the GLib thread, and the typed lists make that affinity
    compiler-enforced.

## Not viable — checked and closed

These were proposed by analyzers and refuted in verification; recorded so the avenues are not
re-explored:

- **`src/module/gobject.rs:23-34` — instance GType via `Borrowed<glib::Object>` +
  `ObjectExt::type_`**: callers pass arbitrary `GTypeInstance` pointers, not guaranteed GObjects
  (GParamSpec is a documented non-GObject case; `registry.ts` queries the GType precisely to decide
  afterward whether the instance is a GObject). Wrapping trips the wrapper macro's
  `instance_of::<Object>` debug assert and `ObjectRef`'s `ref_count` assert, which reads
  GObject-layout memory beyond a bare 8-byte `GTypeInstance` — an out-of-bounds read Miri would
  report on the existing zeroed-instance test. The graceful return-0 path for a null `g_class` is
  inexpressible: `object_class()` forms `&ObjectClass` unconditionally, instant UB when null.
- **`src/managed/boxed.rs:84-87` — sized GType-less struct copies via `glib::collections::Slice`**:
  GType-less C structs routinely contain uninitialized interior padding; `Slice` materializes a
  `&[u8]` and performs typed per-byte reads — both UB over padding under the Rust abstract machine,
  where the current untyped `copy_nonoverlapping` is documented sound. Also inflates every copy
  from exactly `s` bytes to `next_power_of_two(max(s, 256))` via `g_realloc` on the benchmarked
  decode path.
- **`src/module/register_class.rs:339-343` — permanent class reference via
  `glib::object::Class::from_type`**: `from_type` pre-checks `is_a(Object::static_type())`, but the
  primitive's parent gtype is dynamic JS data and the current contract accepts any classed parent
  (e.g. a GParamSpec-derived fundamental). The wrapper would return None and skip the eager class
  init plus interface vtable installs that `g_type_class_ref` forces — input-domain narrowing of a
  JS-driven primitive. glib 0.22.7 has no class-ref wrapper for arbitrary classed types (`IsClass`
  covers only object wrappers), and `ClassRef`'s pointer is private behind a shared-reference
  Deref, while `PreparedInterface::install` needs `*mut c_void`.
- **`src/types/array.rs:494-535` — contiguous scalar decode via
  `glib::translate::FromGlibContainerAsVec`**: materializes an intermediate `Vec<f32>/Vec<f64>/
  Vec<bool>` that must be re-iterated into `Vec<value::Value>` — one extra allocation plus one
  extra pass per array decode, replacing a zero-copy borrowed-slice map on the benchmarked path.
  The helpers are themselves `unsafe fn`s and the element cast remains at the call site, so the
  audited invariants are unchanged: the gain is naming only. Worse, `from_glib_container_num_as_vec`
  on a GArray's data pointer would `g_free` memory the GArray still owns before `g_array_unref`
  runs — a double free.
- **`src/types/string.rs:54-77` — returned C strings via `GString::from_ptr_lossy` (full-ownership
  variant)**: GLib's `g_utf8_make_valid` and Rust's `to_string_lossy` differ in U+FFFD replacement
  on invalid input, changing the string JS receives; the invalid-UTF-8 branch gains one allocation
  and one extra libglib call on the benchmarked decode path; and since the target type is a Rust
  `String` and the manual `g_free` must remain, no version of the swap removes unsafe code. (The
  narrowed conversion-only variant survives as the `from_ptr_lossy` finding in §5.)

## Cross-cutting theme

glib's translate layer assumes static knowledge of types and transfer modes; this package's
contract is runtime data from JS. The viable adoptions are exactly the ones where the ownership
mode is resolved before the wrapper is chosen (branch first, then `from_glib_full` /
`from_glib_borrow` / `into_glib_ptr`), and the rejections are the ones where an abstraction bakes
in a static assumption (UTF-8 validity, GObject layout, `is_a(Object)` parents, slice lifetimes)
that the dynamic contract violates.

## Resolution status (2026-06-11)

Every `confirmed`/`partial` item above is adopted and verified except the five marked with a
`Decision:` note, each skipped on the caveat the item itself records (legibility-critical raw
calls, marginal gain, or low confidence). The §6 connect primitive landed with all four required
corrections: `SignalId::parse_name` with `force_detail`, the never-panic return contract through
`NativeErrorReporter` plus `glib::Value::from_type` defaults, `RustClosure::new_local` paired with
`connect_closure_id`, and `G_TYPE_POINTER` extraction for `ref`-typed inout parameters flushed
through `write_value_to_raw_ptr`.

## Suggested ordering

1. §1 defect fixes and §3 dependency removal (small, self-contained, immediate value).
2. §2 and §5 as a mechanical batch (zero-cost swaps plus hot-path allocation wins).
3. §4 GByteArray and §7 StrV/lists (shared `FfiStorage` restructuring).
4. §6 signal-closure primitive as its own project (touches `packages/ffi/src/signals.ts` and the
   JS contract).
