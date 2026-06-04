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
//! The binding stores its wrapper inside the object's qdata as a napi
//! `napi_ref`. The reference's refcount encodes collectability:
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
//! teardown. Every binding carries a process-unique epoch: [`install`] stamps a
//! fresh one and the decode path re-stamps via [`note_reacquired`] each time it
//! re-acquires an object that still carries a wrapper. A cleanup captures the
//! epoch when scheduled and, if it no longer matches — because the object was
//! re-acquired, its address was reused, or it was already torn down — drops only
//! its own `napi_ref` and leaves the rest to the live binding, *without
//! dereferencing the possibly-freed object*. The epoch is process-unique and the
//! absent value `0` is never assigned, so this comparison alone distinguishes a
//! live sole binding from a superseded or dead one. A matching epoch means this
//! wrapper's toggle ref is still the object's sole binding holder, so the full
//! teardown is safe; [`install`] reuses that toggle ref on a rebind instead of
//! adding a second. This keeps exactly one toggle ref per object across rebinds
//! and is exercised by `@gtkx/ffi`'s `observe-controllers-lifetime` test.
//!
//! This single-`GLib`-thread serialization is the lifetime system's one
//! cross-thread ordering guarantee; no change may move the notify or the cleanup
//! off the `GLib` thread without replacing it. The race is exercised by
//! `tests/module/toggle-cross-thread.test.ts`.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::collections::HashMap;
use std::ffi::c_void;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

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

/// Quark under which each tracked `GObject` stores its wrapper `napi_ref`.
static WRAPPER_QUARK: OnceLock<glib::ffi::GQuark> = OnceLock::new();

/// Source of process-unique wrapper-binding epochs.
///
/// Each fresh [`install`] and each re-acquisition ([`note_reacquired`]) stamps
/// the object with the next value, so an epoch is unique across the whole
/// process — even after a `GObject` is finalized and its address reused. A
/// deferred teardown ([`schedule_cleanup`]) captures the object's epoch when
/// scheduled and, if it has since changed (supersession or address reuse) or the
/// object has been torn down (no epoch), skips finalizing — detecting all of
/// that by an integer comparison alone, never dereferencing a possibly-freed
/// object. The absent value `0` is never assigned, so a captured epoch (always
/// `>= 1`) cannot collide with a forgotten entry.
static NEXT_BINDING_EPOCH: AtomicU64 = AtomicU64::new(1);

/// Live binding epoch per `GObject` address. Mutex-guarded because
/// [`schedule_cleanup`] reads it on the JS thread (from the napi finalizer)
/// while [`note_reacquired`], [`install`], and the teardown body run on the
/// `GLib` thread. Entries are dropped on full teardown, so the map tracks only
/// objects with a live binding.
static BINDING_EPOCHS: OnceLock<Mutex<HashMap<usize, u64>>> = OnceLock::new();

fn binding_epochs() -> &'static Mutex<HashMap<usize, u64>> {
    BINDING_EPOCHS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Stamps `gobject_addr` with a fresh process-unique binding epoch, replacing
/// any prior one.
fn stamp_binding_epoch(gobject_addr: usize) {
    let epoch = NEXT_BINDING_EPOCH.fetch_add(1, Ordering::Relaxed);
    binding_epochs().lock().unwrap().insert(gobject_addr, epoch);
}

fn binding_epoch(gobject_addr: usize) -> u64 {
    binding_epochs()
        .lock()
        .unwrap()
        .get(&gobject_addr)
        .copied()
        .unwrap_or(0)
}

fn forget_binding_epoch(gobject_addr: usize) {
    binding_epochs().lock().unwrap().remove(&gobject_addr);
}

/// Records that the decode path handed back an object that still carried a
/// wrapper.
///
/// Stamps a fresh binding epoch, so a teardown scheduled for an earlier wrapper
/// detects the revival and leaves the object's toggle ref intact.
///
/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject`. May run on either
/// thread, but is called from the decode path on the `GLib` thread.
pub unsafe fn note_reacquired(gobject: *mut glib::gobject_ffi::GObject) {
    stamp_binding_epoch(gobject as usize);
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

/// Reads the wrapper `napi_ref` stored in `gobject`'s qdata, or null when the
/// instance is not a `GObject` or has no wrapper attached.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GTypeInstance`. Must run
/// on the `GLib` thread.
#[must_use]
pub unsafe fn wrapper_ref(gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
    if gobject.is_null() || !unsafe { is_gobject(gobject) } {
        return std::ptr::null_mut();
    }
    unsafe { glib::gobject_ffi::g_object_get_qdata(gobject, wrapper_quark()) }
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
    !unsafe { wrapper_ref(gobject) }.is_null()
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

/// Binds the wrapper `napi_ref` to `gobject`, installing or reusing its toggle
/// ref so the object always carries exactly one.
///
/// On a fresh bind (no wrapper ref in qdata) the decode path left exactly one
/// pending owned reference on the object (a sunk floating ref, the caller's
/// transfer-full ref, or a fresh ref for transfer-none); this stores the
/// wrapper ref in qdata, adds the toggle ref, then releases that one pending
/// reference, leaving the toggle ref alone. If the object is otherwise unheld
/// the final unref fires [`on_toggle_notify`] with `is_last_ref == true`,
/// weakening the wrapper synchronously.
///
/// On a rebind — when a stale wrapper whose teardown has not run still occupies
/// qdata (the decode path already released its pending reference and bumped the
/// generation via [`note_reacquired`]) — this overwrites the qdata ref and
/// **reuses** the existing toggle ref instead of adding a second, which would
/// make `GObject` emit "Unexpected number of toggle-refs". A balanced
/// `ref`/`unref` re-fires the toggle notify so the new wrapper adopts the
/// correct strong/weak state for the object's current holders.
///
/// # Safety
///
/// `gobject` must be a valid pointer to a live `GObject` carrying one pending
/// owned reference on a fresh bind. `ref_ptr` must be a live `napi_ref`. Must
/// run on the `GLib` thread.
pub unsafe fn install(gobject: *mut glib::gobject_ffi::GObject, ref_ptr: *mut c_void) {
    unsafe {
        let existing = wrapper_ref(gobject);
        glib::gobject_ffi::g_object_set_qdata(gobject, wrapper_quark(), ref_ptr);
        if existing.is_null() {
            stamp_binding_epoch(gobject as usize);
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
        } else {
            glib::gobject_ffi::g_object_ref(gobject);
        }
        glib::gobject_ffi::g_object_unref(gobject);
    }
}

/// Schedules teardown for a wrapper whose JavaScript object has been collected.
///
/// Called from the napi finalizer on the JS thread. Posts a fire-and-forget
/// `GLib`-thread task — at the default idle priority, below the frame clock —
/// that clears the qdata slot (so no later notify or lookup touches the
/// reference), deletes the `napi_ref` on the JS thread, then removes the toggle
/// ref, which finalizes the object when the toggle ref was its last holder.
///
/// The low priority is deliberate: a draw, tick, or animation callback already
/// queued against the object must run while the object is still alive, so the
/// finalize waits behind that pending work rather than racing ahead of it.
/// Serializing the teardown on the `GLib` thread also keeps it from racing a
/// concurrent toggle notify.
pub fn schedule_cleanup(gobject_addr: usize, ref_addr: usize) {
    if Mailbox::global().is_stopped() {
        return;
    }
    let scheduled_epoch = binding_epoch(gobject_addr);
    glib::idle_add_once(move || {
        let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
        let ref_ptr = ref_addr as *mut c_void;

        // Compare the binding epoch before touching `gobject`: if it changed (the
        // object was handed back out and stamped anew, or its address was reused
        // by a different object) or is gone (the object was already torn down),
        // the toggle ref and qdata belong to a live, newer binding or to nothing
        // at all — and `gobject` may already be freed, so it must not be
        // dereferenced. Drop only this wrapper's orphaned reference.
        if binding_epoch(gobject_addr) != scheduled_epoch {
            invoke_ref_op(ref_ptr, OP_DELETE);
            return;
        }

        // The epoch is unchanged, so this wrapper's toggle ref is still the
        // object's sole binding holder: the object is alive and qdata still
        // points at this wrapper.
        unsafe {
            glib::gobject_ffi::g_object_set_qdata(gobject, wrapper_quark(), std::ptr::null_mut());
        }
        forget_binding_epoch(gobject_addr);
        invoke_ref_op(ref_ptr, OP_DELETE);
        unsafe {
            glib::gobject_ffi::g_object_remove_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
        }
    });
}
