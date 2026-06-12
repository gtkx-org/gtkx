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
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use napi::JsFunction;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::value::{JsRef, Value};

/// Reference operation applied to a wrapper's `napi_ref` on the JS thread,
/// crossing the boundary as its integer discriminant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum RefOp {
    /// Decrement the wrapper reference to weak (collectable).
    Weaken = 0,
    /// Increment the wrapper reference to strong (pinned).
    Strengthen = 1,
    /// Delete the wrapper reference once its object is being torn down.
    Delete = 2,
}

impl RefOp {
    /// Resolves an opcode received from JavaScript, or `None` for an unknown
    /// value — the deliberate no-op fallback, so a stray call can never
    /// destroy a wrapper reference.
    #[must_use]
    pub fn from_opcode(op: u32) -> Option<Self> {
        match op {
            0 => Some(Self::Weaken),
            1 => Some(Self::Strengthen),
            2 => Some(Self::Delete),
            _ => None,
        }
    }
}

/// The single JavaScript callback that applies a reference operation by opcode.
/// Installed once via the `setObjectToggleNotify` napi export. Invoked
/// synchronously on the JS thread through [`Mailbox::invoke_node_and_wait`].
static TOGGLE_CB: OnceLock<Arc<JsRef<JsFunction>>> = OnceLock::new();

/// Quark under which each tracked `GObject` stores its [`WrapperBinding`] cell.
static WRAPPER_QUARK: OnceLock<glib::Quark> = OnceLock::new();

/// Per-object binding state, stored in qdata and reached off the object by a
/// deferred cleanup.
///
/// One cell exists per tracked object for as long as the object carries a toggle
/// ref or any of its wrappers has a pending finalizer. It is held by an `Arc`
/// whose strong count is shared between two kinds of owner: the qdata slot (one
/// count, reclaimed by the full teardown) and each pending finalizer (one count
/// per wrapper, dropped when that wrapper's cleanup task ends). The cell
/// therefore outlives the `GObject`, so a stale cleanup or a deferred foreign-
/// thread notify can read it without touching freed memory.
pub(crate) struct WrapperBinding {
    /// The current wrapper's `napi_ref`, as a `usize`. Overwritten by [`install`]
    /// on each rebind so [`wrapper_ref`] and [`on_toggle_notify`] always see the
    /// live wrapper.
    napi_ref: AtomicUsize,
    /// Generation of the current binding: `1` on a fresh bind, incremented on
    /// each rebind, and `0` once the full teardown has run. A finalizer captures
    /// the value in effect at its bind, so only the live binding's cleanup finds
    /// a match.
    generation: AtomicU64,
    /// The strong/weak level last applied to the wrapper's `napi_ref` —
    /// `true` at each bind, since `set_wrapper` normalizes the fresh
    /// reference's count to exactly one before installing. The
    /// reference operations are counted (`napi_reference_ref`/`unref` move a
    /// count whose protocol invariant is {0, 1}), so every notify routes
    /// through [`apply_wrapper_level`], which flips this level and issues the
    /// matching counted operation only on a transition. Without it, two
    /// deferred notifies recomputing the same level would double-apply an
    /// operation, pinning the wrapper strong (leaking the object) or
    /// underflowing the weak side.
    wrapper_strong: AtomicBool,
}

/// Serializes foreign-thread binding lookups against the teardown that frees
/// the cell. [`binding_arc`]'s qdata read and strong-count increment are two
/// separate internally-synchronized steps; the lock makes them atomic with
/// respect to the teardown's slot-clear + raw-count reclaim, so a lookup can
/// never increment the count of a cell whose last count the teardown already
/// reclaimed.
static BINDING_LOOKUP_LOCK: Mutex<()> = Mutex::new(());

/// Applies a strong/weak level to the wrapper's `napi_ref`, issuing the
/// counted reference operation only when the level actually changes.
fn apply_wrapper_level(binding: &WrapperBinding, ref_ptr: *mut c_void, strong: bool) {
    if binding.wrapper_strong.swap(strong, Ordering::AcqRel) == strong {
        return;
    }
    let op = if strong {
        RefOp::Strengthen
    } else {
        RefOp::Weaken
    };
    invoke_ref_op(ref_ptr, op);
}

/// Installs the JavaScript reference-operation callback. Called once at startup;
/// later calls are ignored to keep the singleton write-once.
pub fn initialize(callback: Arc<JsRef<JsFunction>>) {
    let _ = TOGGLE_CB.set(callback);
}

fn wrapper_quark() -> glib::Quark {
    *WRAPPER_QUARK.get_or_init(|| glib::Quark::from_static_str(glib::gstr!("gtkx-wrapper-ref")))
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
    // SAFETY: The caller guarantees `instance` is a live GTypeInstance,
    // whose class field the type check reads.
    unsafe { glib::types::instance_of::<glib::Object>(instance.cast()) }
}

/// Reads the [`WrapperBinding`] cell stored in `gobject`'s qdata, or null when
/// the instance is not a `GObject` or has no binding attached.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GTypeInstance`. Must run
/// on the `GLib` thread.
unsafe fn binding_ptr(gobject: *mut glib::gobject_ffi::GObject) -> *const WrapperBinding {
    // SAFETY: The caller guarantees `gobject` is null or a live
    // GTypeInstance, and the null case is handled here.
    if gobject.is_null() || !unsafe { is_gobject(gobject) } {
        return std::ptr::null();
    }
    // SAFETY: `gobject` was just verified to be a live GObject, the
    // receiver qdata access requires.
    unsafe { glib::gobject_ffi::g_object_get_qdata(gobject, wrapper_quark().into_glib()) }
        .cast::<WrapperBinding>()
}

/// Clones the `Arc` holding `gobject`'s [`WrapperBinding`] cell, or `None`
/// when the instance is not a `GObject` or has no binding attached.
///
/// Unlike [`binding_ptr`], this is safe to call from any thread: `GObject`
/// qdata reads and `Arc` count adjustments are both internally synchronized,
/// and the returned `Arc` keeps the cell alive independently of the object.
///
/// # Safety
///
/// `gobject` must be null or a valid pointer to a live `GTypeInstance`.
unsafe fn binding_arc(gobject: *mut glib::gobject_ffi::GObject) -> Option<Arc<WrapperBinding>> {
    let _serialized = BINDING_LOOKUP_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    // SAFETY: The caller's contract for `gobject` carries over to
    // binding_ptr.
    let ptr = unsafe { binding_ptr(gobject) };
    if ptr.is_null() {
        return None;
    }
    // SAFETY: The lookup lock orders this against the teardown's
    // slot-clear + reclaim, so a non-null read proves the qdata slot still
    // holds its raw Arc count; the increment pairs with the Arc this
    // returns.
    unsafe {
        Arc::increment_strong_count(ptr);
        Some(Arc::from_raw(ptr))
    }
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
    // SAFETY: The caller's contract for `gobject` carries over to
    // binding_ptr.
    let binding = unsafe { binding_ptr(gobject) };
    if binding.is_null() {
        return std::ptr::null_mut();
    }
    // SAFETY: The qdata slot's Arc count keeps the non-null cell alive
    // until the GLib-thread teardown clears the slot, which cannot race
    // this GLib-thread read.
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
    // SAFETY: The caller's contract for `gobject` carries over to
    // binding_ptr.
    !unsafe { binding_ptr(gobject) }.is_null()
}

/// Drives one reference operation on the JS thread, blocking the `GLib` thread
/// until it completes. A no-op once the mailbox is stopped or before the
/// callback is installed, so shutdown leaks the reference rather than touching a
/// dead runtime.
fn invoke_ref_op(ref_ptr: *mut c_void, op: RefOp) {
    let mailbox = Mailbox::global();
    if mailbox.is_stopped() {
        return;
    }
    let Some(callback) = TOGGLE_CB.get() else {
        return;
    };
    let args = vec![
        Value::Number(ref_ptr as usize as f64),
        Value::Number(f64::from(op as u32)),
    ];
    if let Err(error) = mailbox.invoke_node_and_wait(callback, args, false) {
        NativeErrorReporter::global().report(&error.context(
            "toggle-reference operation failed; wrapper lifetime state may be inconsistent",
        ));
    }
}

/// Toggle notify installed by [`install`]. Flips the wrapper reference
/// strong/weak on the JS thread.
///
/// `GLib` fires the notify on whichever thread performs the boundary-crossing
/// ref or unref. On the `GLib` thread — the overwhelmingly common case — the
/// flip runs synchronously, before the triggering operation returns, so no GC
/// window can open. A notify on any other thread (a GIO pool worker releasing
/// a task's source object, a `GDBus` worker dropping a connection reference)
/// must not read qdata or round-trip to JS from there: it would race the
/// GLib-thread teardown and could drain GLib-bound mailbox tasks on a foreign
/// thread. Such a notify is instead deferred to the `GLib` thread, where it
/// re-reads the binding through its own `Arc` (alive independently of the
/// object) and recomputes the strong/weak level from the current reference
/// count, so a stale edge can never overwrite a newer state.
unsafe extern "C" fn on_toggle_notify(
    _data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    if glib::MainContext::default().is_owner() {
        // SAFETY: GObject fires the toggle notify with the live instance,
        // and this branch runs on the GLib thread.
        let binding = unsafe { binding_ptr(gobject) };
        if binding.is_null() {
            return;
        }
        // SAFETY: The qdata slot's Arc count keeps the non-null cell alive;
        // the GLib-thread teardown cannot run concurrently with this notify.
        let binding = unsafe { &*binding };
        let ref_ptr = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
        if ref_ptr.is_null() {
            return;
        }
        apply_wrapper_level(binding, ref_ptr, is_last_ref == 0);
        return;
    }

    // SAFETY: GObject fires the toggle notify with the live instance;
    // binding_arc's qdata read and Arc adjustment are internally
    // synchronized, so a foreign thread may call it.
    let Some(binding) = (unsafe { binding_arc(gobject) }) else {
        return;
    };
    let gobject_addr = gobject as usize;
    Mailbox::global().schedule_glib(Box::new(move || {
        if binding.generation.load(Ordering::Relaxed) == 0 {
            return;
        }
        let ref_ptr = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
        if ref_ptr.is_null() {
            return;
        }
        let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
        // SAFETY: A non-zero generation means the binding's toggle ref
        // still holds the object alive on this GLib thread.
        let ref_count = unsafe { (*gobject).ref_count };
        apply_wrapper_level(&binding, ref_ptr, ref_count > 1);
    }));
}

/// Binds the wrapper `napi_ref` to `gobject` so the object always carries exactly
/// one toggle ref.
///
/// Returns the object's [`WrapperBinding`] cell together with this bind's
/// generation, for the wrapper's finalizer to capture.
///
/// The decode path leaves exactly one pending owned reference on the object per
/// crossing (a sunk floating ref, the caller's transfer-full ref, or a fresh
/// ref); when `consume_pending` is set this install is that reference's
/// consumer and releases it last. On a fresh bind (no cell in qdata) this
/// allocates the cell at generation `1`, stores one `Arc` count in qdata,
/// returns a second count for the finalizer, and adds the toggle ref before the
/// release; if the object is otherwise unheld the release fires
/// [`on_toggle_notify`] with `is_last_ref == true`, weakening the wrapper
/// synchronously.
///
/// On a rebind — when a stale wrapper whose teardown has not run still occupies
/// qdata — this overwrites the cell's `napi_ref`, bumps its generation, returns
/// a fresh `Arc` count for the new wrapper's finalizer, and **reuses** the
/// existing toggle ref instead of adding a second, which would make `GObject`
/// emit "Unexpected number of toggle-refs". Releasing the pending reference
/// re-fires the toggle notify when the toggle boundary is crossed, so the new
/// wrapper adopts the correct strong/weak state for the object's current
/// holders.
///
/// # Safety
///
/// `gobject` must be a valid pointer to a live `GObject`, carrying one pending
/// owned reference when `consume_pending` is set. `ref_ptr` must be a live
/// `napi_ref`. Must run on the `GLib` thread.
pub(crate) unsafe fn install(
    gobject: *mut glib::gobject_ffi::GObject,
    ref_ptr: *mut c_void,
    consume_pending: bool,
) -> (Arc<WrapperBinding>, u64) {
    // SAFETY: The caller guarantees `gobject` is a live GObject and that
    // this runs on the GLib thread. A fresh bind stores one raw Arc count
    // in qdata (reclaimed by the matching teardown); a rebind takes one
    // additional count for the new finalizer from the live cell the qdata
    // slot still owns.
    unsafe {
        let existing = binding_ptr(gobject);
        let result = if existing.is_null() {
            let cell = Arc::new(WrapperBinding {
                napi_ref: AtomicUsize::new(ref_ptr as usize),
                generation: AtomicU64::new(1),
                wrapper_strong: AtomicBool::new(true),
            });
            glib::gobject_ffi::g_object_set_qdata(
                gobject,
                wrapper_quark().into_glib(),
                Arc::into_raw(Arc::clone(&cell)) as *mut c_void,
            );
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
            (cell, 1)
        } else {
            let generation = (*existing).generation.load(Ordering::Relaxed) + 1;
            (*existing)
                .napi_ref
                .store(ref_ptr as usize, Ordering::Relaxed);
            (*existing).generation.store(generation, Ordering::Relaxed);
            (*existing).wrapper_strong.store(true, Ordering::Release);
            Arc::increment_strong_count(existing);
            (Arc::from_raw(existing), generation)
        };
        if consume_pending {
            glib::gobject_ffi::g_object_unref(gobject);
        }
        result
    }
}

/// Schedules teardown for a wrapper whose JavaScript object has been collected.
///
/// Called from the napi finalizer on the JS thread with the object's
/// [`WrapperBinding`] cell (the finalizer's own `Arc` clone), the `generation`
/// captured when this wrapper was bound, and the addresses of the object and
/// this wrapper's `napi_ref`. Posts a fire-and-forget `GLib`-thread task at the
/// default idle priority, below the frame clock.
///
/// The task decides its fate through the cell, never the object: it compares the
/// cell's current generation against `generation`. A mismatch means a rebind
/// superseded this wrapper, or the binding was already torn down — the toggle ref
/// and the object belong to a newer binding or to nothing — so it drops only this
/// wrapper's `napi_ref`, dereferencing neither the object nor the toggle ref. A
/// match means this wrapper is still the live binding, so the reused toggle ref
/// still holds the object alive: it zeroes the generation, clears qdata (so no
/// later notify or lookup finds the cell), reclaims the qdata slot's `Arc`
/// count, deletes the reference on the JS thread, and removes the toggle ref
/// (which finalizes the object when the toggle ref was its last holder). The
/// finalizer's own `Arc` clone drops when the task ends.
///
/// A `binding` of `None` marks a wrapper whose [`install`] never ran (a
/// dispatch failure during shutdown): there is no cell or toggle ref, so the
/// task only deletes the reference.
///
/// The low priority is deliberate: a draw, tick, or animation callback already
/// queued against the object must run while the object is still alive, so the
/// finalize waits behind that pending work rather than racing ahead of it.
/// Serializing the teardown on the `GLib` thread also keeps it from racing a
/// concurrent toggle notify.
pub(crate) fn schedule_cleanup(
    binding: Option<Arc<WrapperBinding>>,
    generation: u64,
    gobject_addr: usize,
    ref_addr: usize,
) {
    if Mailbox::global().is_stopped() {
        return;
    }
    glib::idle_add_once(move || {
        let ref_ptr = ref_addr as *mut c_void;

        let Some(binding) = binding else {
            invoke_ref_op(ref_ptr, RefOp::Delete);
            return;
        };

        if binding.generation.load(Ordering::Relaxed) != generation {
            invoke_ref_op(ref_ptr, RefOp::Delete);
            return;
        }

        let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
        binding.generation.store(0, Ordering::Relaxed);
        {
            let _serialized = BINDING_LOOKUP_LOCK
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            // SAFETY: The generation match proves this wrapper is the live
            // binding, so its reused toggle ref keeps `gobject` alive; the
            // qdata slot holds exactly one raw Arc count, reclaimed here
            // after the slot is cleared, with the lookup lock held so no
            // foreign-thread lookup can be between its read and its
            // increment.
            unsafe {
                glib::gobject_ffi::g_object_set_qdata(
                    gobject,
                    wrapper_quark().into_glib(),
                    std::ptr::null_mut(),
                );
                drop(Arc::from_raw(Arc::as_ptr(&binding)));
            }
        }
        invoke_ref_op(ref_ptr, RefOp::Delete);
        // SAFETY: The toggle ref being removed is the one `install` added
        // for this binding and still holds the object alive; removal may
        // finalize the object, after which nothing here touches it.
        unsafe {
            glib::gobject_ffi::g_object_remove_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
        }
    });
}
