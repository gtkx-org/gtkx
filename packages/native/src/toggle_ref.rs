//! `GObject` toggle references for unified wrapper lifetime.
//!
//! A `registerClass` subclass or any wrapped `GObject` must keep the *same*
//! JavaScript wrapper for as long as the object is reachable from either side:
//! JavaScript code or a native container (a `Gio.ListStore`, a parent widget).
//! A plain `g_object_ref` cannot express that — it keeps the object alive but
//! tells the binding nothing about who else holds it. A **toggle reference**
//! does: it is the binding's single reference, and `GLib` fires a notify when
//! the object's total reference count crosses between "only the toggle ref" and
//! "the toggle ref plus at least one other holder".
//!
//! The binding stores a per-object [`WrapperBinding`] cell inside the object's
//! qdata; the cell holds the wrapper's napi `napi_ref`. The reference's refcount
//! encodes collectability:
//!
//! - **strong** (refcount 1): native code holds another reference, so the
//!   wrapper must survive a JavaScript GC to preserve identity when the object
//!   is handed back. Set when the notify reports `is_last_ref == false`.
//! - **weak** (refcount 0): only the toggle ref remains, so the wrapper is free
//!   to be collected; collecting it removes the toggle ref and finalizes the
//!   object. Set when the notify reports `is_last_ref == true`.
//!
//! The notify fires on whichever thread performs the ref/unref — the `GLib`
//! thread in this binding — and the refcount flip must run on the JavaScript
//! thread (every `napi_reference_*` call requires the JS thread). The flip is
//! therefore routed through [`Mailbox::invoke_node_and_wait`], the same
//! synchronous re-entrant path signal trampolines use, so it completes before
//! the triggering `GLib` operation returns and no GC window can open.
//!
//! All qdata reads and writes happen on the `GLib` thread; all `napi_reference_*`
//! calls happen on the JS thread. The two are bridged by passing the opaque
//! `napi_ref` pointer across as a `usize`, exactly as [`JsRef`] does. Every path
//! here either touches qdata on the `GLib` thread or drives a JS callback, so
//! the module is excluded from coverage instrumentation.
//!
//! # Teardown serialization invariant
//!
//! [`on_toggle_notify`] and the finalize cleanup that [`schedule_cleanup`] posts
//! both run on the `GLib` thread, which dispatches its sources one at a time, so
//! a notify can never execute *concurrently* with a cleanup. Ordering across the
//! boundary is then closed by the sequence the cleanup runs: it clears the qdata
//! slot, deletes the `napi_ref`, and only then removes the toggle ref. A notify
//! that fires after the slot is cleared reads a null reference and returns
//! without touching the dead wrapper (`ref_ptr.is_null()`). A teardown and a
//! stale notify therefore can never both act on one `napi_ref`.
//!
//! # Re-acquisition (rebind) invariant
//!
//! A collected wrapper's cleanup is *deferred*, so the same object can be handed
//! back across the FFI boundary between the wrapper's collection and its
//! teardown. In that window a lookup finds the qdata cell still present but its
//! `napi_ref` already resolving to null, so the registry builds a fresh wrapper
//! and calls [`install`] again. [`install`] detects the occupied cell and
//! **reuses** the existing toggle ref instead of adding a second — which would
//! make `GObject` emit "Unexpected number of toggle-refs" — so exactly one toggle
//! ref exists per object across any number of rebinds.
//!
//! Each object owns one [`WrapperBinding`] cell, held by an `Arc` whose strong
//! count is shared between the qdata slot and every pending finalizer. The cell
//! carries a `generation` that [`install`] bumps on each bind; a finalizer
//! captures the generation in effect when its wrapper was bound. A wrapper that
//! ever bound the object schedules its own cleanup when collected, and those
//! cleanups can dispatch in any order — so a stale cleanup must decide its fate
//! without dereferencing an object a sibling teardown may already have freed. It
//! does so through the cell, never the object: it compares the cell's current
//! `generation` (read through the `Arc`, which outlives the object) against its
//! captured one. A match means no rebind has superseded it and the toggle ref —
//! reused, never removed, across every rebind — still holds the object alive, so
//! the full teardown is safe (zero the generation, clear qdata, drop the qdata
//! `Arc` count, remove the toggle ref). A mismatch means the binding was
//! superseded or already torn down; the cleanup drops only its own `napi_ref` and
//! its `Arc` count, touching neither the object nor the toggle ref. Because the
//! generation is captured at bind time, exactly one cleanup ever matches, and it
//! is the only one that dereferences the object.
//!
//! This single-`GLib`-thread serialization is the lifetime system's one
//! cross-thread ordering guarantee; no change may move the notify or the cleanup
//! off the `GLib` thread without replacing it. The race is exercised by
//! `tests/module/toggle-cross-thread.test.ts`, `tests/module/toggle-rebind.test.ts`,
//! and `@gtkx/ffi`'s `observe-controllers-lifetime` test.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};

use gtk4::glib;
use napi::JsFunction;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::value::{JsRef, Value};

/// Opcode passed to the JavaScript reference-operation callback: decrement the
/// wrapper reference to weak (collectable).
pub const OP_WEAKEN: f64 = 0.0;
/// Opcode: increment the wrapper reference to strong (pinned).
pub const OP_STRENGTHEN: f64 = 1.0;
/// Opcode: delete the wrapper reference once its object is being torn down.
pub const OP_DELETE: f64 = 2.0;

/// The single JavaScript callback that applies a reference operation by opcode.
/// Installed once via the `setObjectToggleNotify` napi export. Invoked
/// synchronously on the JS thread through [`Mailbox::invoke_node_and_wait`].
static TOGGLE_CB: OnceLock<Arc<JsRef<JsFunction>>> = OnceLock::new();

/// Quark under which each tracked `GObject` stores its [`WrapperBinding`] cell.
static WRAPPER_QUARK: OnceLock<glib::ffi::GQuark> = OnceLock::new();

/// Per-object binding state, stored in qdata and reached off the object by a
/// deferred cleanup.
///
/// One cell exists per tracked object for as long as the object carries a toggle
/// ref or any of its wrappers has a pending finalizer. It is held by an `Arc`
/// whose strong count is shared between two kinds of owner: the qdata slot (one
/// count, dropped by the full teardown) and each pending finalizer (one count
/// per wrapper, dropped by that wrapper's cleanup). The cell therefore outlives
/// the `GObject`, so a stale cleanup can read it without touching freed memory.
struct WrapperBinding {
    /// The current wrapper's `napi_ref`, as a `usize`. Overwritten by [`install`]
    /// on each rebind so [`wrapper_ref`] and [`on_toggle_notify`] always see the
    /// live wrapper.
    napi_ref: AtomicUsize,
    /// Generation of the current binding: `1` on a fresh bind, incremented on
    /// each rebind, and `0` once the full teardown has run. A finalizer captures
    /// the value in effect at its bind, so only the live binding's cleanup finds
    /// a match.
    generation: AtomicU64,
}

/// Installs the JavaScript reference-operation callback. Called once at startup;
/// later calls are ignored to keep the singleton write-once.
pub fn initialize(callback: Arc<JsRef<JsFunction>>) {
    let _ = TOGGLE_CB.set(callback);
}

fn wrapper_quark() -> glib::ffi::GQuark {
    *WRAPPER_QUARK.get_or_init(|| unsafe {
        glib::ffi::g_quark_from_static_string(c"gtkx-wrapper-ref".as_ptr())
    })
}

/// Whether `instance` is a `GObject` rather than some other `GTypeInstance`
/// (a `GParamSpec`, for example). Toggle references and `GObject` qdata apply
/// only to `GObject`s, so the wrapper machinery must skip non-`GObject`
/// instances that still flow through the same wrapping entry point.
///
/// # Safety
///
/// `instance` must be a non-null pointer to a live `GTypeInstance`. Must run on
/// the `GLib` thread.
unsafe fn is_gobject(instance: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe {
        glib::gobject_ffi::g_type_check_instance_is_a(
            instance.cast::<glib::gobject_ffi::GTypeInstance>(),
            glib::gobject_ffi::g_object_get_type(),
        ) != 0
    }
}

/// Reads the [`WrapperBinding`] cell stored in `gobject`'s qdata, or null when
/// the instance is not a `GObject` or has no binding attached.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GTypeInstance`. Must run
/// on the `GLib` thread.
unsafe fn binding_ptr(gobject: *mut glib::gobject_ffi::GObject) -> *const WrapperBinding {
    if gobject.is_null() || !unsafe { is_gobject(gobject) } {
        return std::ptr::null();
    }
    unsafe { glib::gobject_ffi::g_object_get_qdata(gobject, wrapper_quark()) }
        .cast::<WrapperBinding>()
}

/// Reads the current wrapper `napi_ref` bound to `gobject`, or null when the
/// instance is not a `GObject` or has no binding attached.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GTypeInstance`. Must run
/// on the `GLib` thread.
#[must_use]
pub unsafe fn wrapper_ref(gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
    let binding = unsafe { binding_ptr(gobject) };
    if binding.is_null() {
        return std::ptr::null_mut();
    }
    unsafe { (*binding).napi_ref.load(Ordering::Relaxed) as *mut c_void }
}

/// Whether `gobject` already has an attached wrapper.
///
/// Lets the decode path return a borrowed handle for an object the registry
/// already tracks, instead of installing a second toggle ref.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GObject`. Must run on
/// the `GLib` thread.
#[must_use]
pub unsafe fn has_wrapper(gobject: *mut glib::gobject_ffi::GObject) -> bool {
    !unsafe { binding_ptr(gobject) }.is_null()
}

/// Drives one reference operation on the JS thread, blocking the `GLib` thread
/// until it completes. A no-op once the mailbox is stopped or before the
/// callback is installed, so shutdown leaks the reference rather than touching a
/// dead runtime.
fn invoke_ref_op(ref_ptr: *mut c_void, op: f64) {
    let mailbox = Mailbox::global();
    if mailbox.is_stopped() {
        return;
    }
    let Some(callback) = TOGGLE_CB.get() else {
        return;
    };
    let args = vec![Value::Number(ref_ptr as usize as f64), Value::Number(op)];
    if let Err(error) = mailbox.invoke_node_and_wait(callback, args, false) {
        NativeErrorReporter::global().report(&error.context(
            "toggle-reference operation failed; wrapper lifetime state may be inconsistent",
        ));
    }
}

/// Toggle notify installed by [`install`]. Fires on the `GLib` thread when the
/// object's reference count crosses the toggle boundary; flips the wrapper
/// reference strong/weak on the JS thread.
unsafe extern "C" fn on_toggle_notify(
    _data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    let ref_ptr = unsafe { wrapper_ref(gobject) };
    if ref_ptr.is_null() {
        return;
    }
    let op = if is_last_ref != 0 {
        OP_WEAKEN
    } else {
        OP_STRENGTHEN
    };
    invoke_ref_op(ref_ptr, op);
}

/// Binds the wrapper `napi_ref` to `gobject` so the object always carries exactly
/// one toggle ref.
///
/// Returns the address of the object's [`WrapperBinding`] cell together with this
/// bind's generation, for the wrapper's finalizer to capture.
///
/// On a fresh bind (no cell in qdata) the decode path left exactly one pending
/// owned reference on the object (a sunk floating ref, the caller's transfer-full
/// ref, or a fresh ref for transfer-none); this allocates the cell at generation
/// `1`, stores it in qdata as one `Arc` count, takes a second count for the
/// finalizer, adds the toggle ref, then releases that one pending reference,
/// leaving the toggle ref alone. If the object is otherwise unheld the final
/// unref fires [`on_toggle_notify`] with `is_last_ref == true`, weakening the
/// wrapper synchronously.
///
/// On a rebind — when a stale wrapper whose teardown has not run still occupies
/// qdata (the decode path already released its pending reference) — this
/// overwrites the cell's `napi_ref`, bumps its generation, takes a fresh `Arc`
/// count for the new wrapper's finalizer, and **reuses** the existing toggle ref
/// instead of adding a second, which would make `GObject` emit "Unexpected number
/// of toggle-refs". A balanced `ref`/`unref` re-fires the toggle notify so the
/// new wrapper adopts the correct strong/weak state for the object's current
/// holders.
///
/// # Safety
///
/// `gobject` must be a valid pointer to a live `GObject` carrying one pending
/// owned reference on a fresh bind. `ref_ptr` must be a live `napi_ref`. Must
/// run on the `GLib` thread.
pub unsafe fn install(
    gobject: *mut glib::gobject_ffi::GObject,
    ref_ptr: *mut c_void,
) -> (usize, u64) {
    unsafe {
        let existing = binding_ptr(gobject);
        let result = if existing.is_null() {
            let cell = Arc::new(WrapperBinding {
                napi_ref: AtomicUsize::new(ref_ptr as usize),
                generation: AtomicU64::new(1),
            });
            let cell_ptr = Arc::into_raw(cell);
            glib::gobject_ffi::g_object_set_qdata(
                gobject,
                wrapper_quark(),
                cell_ptr as *mut c_void,
            );
            Arc::increment_strong_count(cell_ptr);
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
            (cell_ptr as usize, 1)
        } else {
            let generation = (*existing).generation.load(Ordering::Relaxed) + 1;
            (*existing)
                .napi_ref
                .store(ref_ptr as usize, Ordering::Relaxed);
            (*existing).generation.store(generation, Ordering::Relaxed);
            Arc::increment_strong_count(existing);
            glib::gobject_ffi::g_object_ref(gobject);
            (existing as usize, generation)
        };
        glib::gobject_ffi::g_object_unref(gobject);
        result
    }
}

/// Schedules teardown for a wrapper whose JavaScript object has been collected.
///
/// Called from the napi finalizer on the JS thread with the object's
/// [`WrapperBinding`] cell (`binding_addr`, holding one `Arc` count for this
/// finalizer), the `generation` captured when this wrapper was bound, and the
/// addresses of the object and this wrapper's `napi_ref`. Posts a
/// fire-and-forget `GLib`-thread task at the default idle priority, below the
/// frame clock.
///
/// The task decides its fate through the cell, never the object: it compares the
/// cell's current generation against `generation`. A mismatch means a rebind
/// superseded this wrapper, or the binding was already torn down — the toggle ref
/// and the object belong to a newer binding or to nothing — so it drops only this
/// wrapper's `napi_ref` and this finalizer's `Arc` count, dereferencing neither
/// the object nor the toggle ref. A match means this wrapper is still the live
/// binding, so the reused toggle ref still holds the object alive: it zeroes the
/// generation, clears qdata (so no later notify or lookup finds the cell), drops
/// the qdata `Arc` count, deletes the reference on the JS thread, removes the
/// toggle ref (which finalizes the object when the toggle ref was its last
/// holder), and finally drops this finalizer's `Arc` count.
///
/// A `binding_addr` of `0` marks a wrapper whose [`install`] never ran (a
/// dispatch failure during shutdown): there is no cell or toggle ref, so the task
/// only deletes the reference.
///
/// The low priority is deliberate: a draw, tick, or animation callback already
/// queued against the object must run while the object is still alive, so the
/// finalize waits behind that pending work rather than racing ahead of it.
/// Serializing the teardown on the `GLib` thread also keeps it from racing a
/// concurrent toggle notify.
pub fn schedule_cleanup(
    binding_addr: usize,
    generation: u64,
    gobject_addr: usize,
    ref_addr: usize,
) {
    if Mailbox::global().is_stopped() {
        return;
    }
    glib::idle_add_once(move || {
        let ref_ptr = ref_addr as *mut c_void;

        if binding_addr == 0 {
            invoke_ref_op(ref_ptr, OP_DELETE);
            return;
        }

        let binding = binding_addr as *const WrapperBinding;
        if unsafe { (*binding).generation.load(Ordering::Relaxed) } != generation {
            invoke_ref_op(ref_ptr, OP_DELETE);
            unsafe { Arc::decrement_strong_count(binding) };
            return;
        }

        let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
        unsafe { (*binding).generation.store(0, Ordering::Relaxed) };
        unsafe {
            glib::gobject_ffi::g_object_set_qdata(gobject, wrapper_quark(), std::ptr::null_mut());
        }
        unsafe { Arc::decrement_strong_count(binding) };
        invoke_ref_op(ref_ptr, OP_DELETE);
        unsafe {
            glib::gobject_ffi::g_object_remove_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
        }
        unsafe { Arc::decrement_strong_count(binding) };
    });
}
