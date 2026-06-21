#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};

use glib::translate::IntoGlib as _;
use parking_lot::Mutex;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefOp {
    Weaken,
    Strengthen,
    Delete,
}

impl RefOp {
    pub(crate) fn apply(self, env: &napi::Env, ref_ptr: usize) {
        use napi::sys;

        let raw_ref = ref_ptr as sys::napi_ref;
        let mut count: u32 = 0;
        // SAFETY: this runs on the Node (JS) thread (it is dispatched as a node task), `env` is
        // the live napi env for that thread, and `raw_ref` is the napi reference recorded in the
        // wrapper binding; each call adjusts or deletes exactly that reference.
        unsafe {
            match self {
                Self::Strengthen => {
                    sys::napi_reference_ref(env.raw(), raw_ref, &mut count);
                }
                Self::Weaken => {
                    sys::napi_reference_unref(env.raw(), raw_ref, &mut count);
                }
                Self::Delete => {
                    sys::napi_delete_reference(env.raw(), raw_ref);
                }
            }
        }
    }
}

pub struct WrapperBinding {
    napi_ref: AtomicUsize,
    generation: AtomicU64,
    wrapper_strong: AtomicBool,
}

#[derive(Debug)]
pub struct WrapperRegistry {
    quark: OnceLock<glib::Quark>,
    lookup_lock: Mutex<()>,
}

static REGISTRY: OnceLock<WrapperRegistry> = OnceLock::new();

impl WrapperRegistry {
    pub fn global() -> &'static Self {
        REGISTRY.get_or_init(|| Self {
            quark: OnceLock::new(),
            lookup_lock: Mutex::new(()),
        })
    }

    fn quark(&self) -> glib::Quark {
        *self
            .quark
            .get_or_init(|| glib::Quark::from_static_str(glib::gstr!("gtkx-wrapper-ref")))
    }

    fn apply_wrapper_level(binding: &WrapperBinding, ref_ptr: *mut c_void, strong: bool) {
        if binding.wrapper_strong.swap(strong, Ordering::AcqRel) == strong {
            return;
        }
        let op = if strong {
            RefOp::Strengthen
        } else {
            RefOp::Weaken
        };
        Self::invoke_ref_op(ref_ptr, op);
    }

    /// # Safety
    ///
    /// `gobject` must be null or point to a live `GObject` owned by the gtkx-glib thread. The
    /// returned pointer borrows the binding stored as qdata; it is valid only while that qdata
    /// entry lives and must not outlive a concurrent cleanup.
    unsafe fn binding_ptr(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
    ) -> *const WrapperBinding {
        // SAFETY: `is_gobject` only dereferences `gobject` after the null check, and the caller
        // guarantees a live GObject; it confirms the instance is a `GObject` before qdata access.
        if gobject.is_null() || !unsafe { is_gobject(gobject) } {
            return std::ptr::null();
        }
        // SAFETY: `gobject` is a live GObject per the contract; `g_object_get_qdata` reads the
        // pointer previously stored under our quark (null if none), which is a `WrapperBinding`.
        unsafe { glib::gobject_ffi::g_object_get_qdata(gobject, self.quark().into_glib()) }
            .cast::<WrapperBinding>()
    }

    /// # Safety
    ///
    /// `gobject` must be null or point to a live `GObject` owned by the gtkx-glib thread. The
    /// `lookup_lock` is held while reading the qdata so the binding cannot be torn down between
    /// the read and the strong-count increment.
    unsafe fn binding_arc(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
    ) -> Option<Arc<WrapperBinding>> {
        let _serialized = self.lookup_lock.lock();
        // SAFETY: forwards the caller's live-GObject guarantee to `binding_ptr`.
        let ptr = unsafe { self.binding_ptr(gobject) };
        if ptr.is_null() {
            return None;
        }
        // SAFETY: `ptr` is a non-null `WrapperBinding` produced by `Arc::into_raw` in `install`,
        // still alive under the held `lookup_lock`; incrementing its strong count and rebuilding
        // an `Arc` yields one additional owning handle without dropping the registry's copy.
        unsafe {
            Arc::increment_strong_count(ptr);
            Some(Arc::from_raw(ptr))
        }
    }

    /// # Safety
    ///
    /// `gobject` must be null or point to a live `GObject` owned by the gtkx-glib thread.
    #[must_use]
    pub unsafe fn wrapper_ref(&self, gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
        // SAFETY: forwards the caller's live-GObject guarantee to `binding_ptr`.
        let binding = unsafe { self.binding_ptr(gobject) };
        if binding.is_null() {
            return std::ptr::null_mut();
        }
        // SAFETY: `binding` is a non-null, live `WrapperBinding`; loading its atomic napi_ref is
        // a plain atomic read.
        unsafe { (*binding).napi_ref.load(Ordering::Relaxed) as *mut c_void }
    }

    /// # Safety
    ///
    /// `gobject` must be null or point to a live `GObject` owned by the gtkx-glib thread.
    #[must_use]
    pub unsafe fn has_wrapper(&self, gobject: *mut glib::gobject_ffi::GObject) -> bool {
        // SAFETY: forwards the caller's live-GObject guarantee to `binding_ptr`.
        !unsafe { self.binding_ptr(gobject) }.is_null()
    }

    fn invoke_ref_op(ref_ptr: *mut c_void, op: RefOp) {
        let mailbox = Mailbox::global();
        if mailbox.is_not_running() || !mailbox.is_initialized() {
            return;
        }
        if let Err(error) = mailbox.apply_wrapper_ref_op_and_wait(ref_ptr as usize, op) {
            NativeErrorReporter::global().report(&error.context(
                "toggle-reference operation failed; wrapper lifetime state may be inconsistent",
            ));
        }
    }

    /// # Safety
    ///
    /// Must run on the gtkx-glib thread. `gobject` must point to a live `GObject`; `ref_ptr` is the
    /// napi reference handle to associate with it. When `consume_pending` is true the caller has
    /// already taken one strong reference on `gobject` that this call releases via `g_object_unref`.
    pub(crate) unsafe fn install(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
        ref_ptr: *mut c_void,
        consume_pending: bool,
    ) -> (Arc<WrapperBinding>, u64) {
        // SAFETY: the whole body runs on the gtkx-glib thread with a live `gobject` per the
        // contract; each FFI/qdata/raw-Arc operation below is sound under that guarantee as noted.
        unsafe {
            // SAFETY: live GObject per the contract, forwarded to `binding_ptr`.
            let existing = self.binding_ptr(gobject);
            let result = if existing.is_null() {
                let cell = Arc::new(WrapperBinding {
                    napi_ref: AtomicUsize::new(ref_ptr as usize),
                    generation: AtomicU64::new(1),
                    wrapper_strong: AtomicBool::new(true),
                });
                // SAFETY: stores a fresh `Arc::into_raw` owning pointer as our quark's qdata on
                // the live `gobject`; ownership of that raw `Arc` is reclaimed in `schedule_cleanup`.
                glib::gobject_ffi::g_object_set_qdata(
                    gobject,
                    self.quark().into_glib(),
                    Arc::into_raw(Arc::clone(&cell)) as *mut c_void,
                );
                // SAFETY: registers the static `on_toggle_notify` toggle reference on the live
                // `gobject`; it is removed in `schedule_cleanup` before the binding is freed.
                glib::gobject_ffi::g_object_add_toggle_ref(
                    gobject,
                    Some(on_toggle_notify),
                    std::ptr::null_mut(),
                );
                (cell, 1)
            } else {
                // SAFETY: `existing` is a non-null, live `WrapperBinding` (its toggle ref keeps it
                // alive); the atomic loads/stores rebind it to the new napi ref and bump the
                // generation, and `increment_strong_count`/`from_raw` hand back an extra owner.
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
                // SAFETY: the caller transferred one strong reference on the live `gobject`; this
                // releases exactly that reference.
                glib::gobject_ffi::g_object_unref(gobject);
            }
            result
        }
    }

    pub(crate) fn schedule_cleanup(
        &'static self,
        binding: Option<Arc<WrapperBinding>>,
        generation: u64,
        gobject_addr: usize,
        ref_addr: usize,
    ) {
        if Mailbox::global().is_not_running() {
            return;
        }
        glib::idle_add_once(move || {
            let ref_ptr = ref_addr as *mut c_void;

            let Some(binding) = binding else {
                Self::invoke_ref_op(ref_ptr, RefOp::Delete);
                return;
            };

            if binding.generation.load(Ordering::Relaxed) != generation {
                Self::invoke_ref_op(ref_ptr, RefOp::Delete);
                return;
            }

            let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
            binding.generation.store(0, Ordering::Relaxed);
            {
                let _serialized = self.lookup_lock.lock();
                // SAFETY: this idle callback runs on the gtkx-glib thread; the generation check
                // above proved `gobject` still carries this binding as qdata. Clearing the qdata
                // and reclaiming the `Arc::into_raw` handle stored in `install` drops the
                // registry's owning reference exactly once, under the held `lookup_lock` so no
                // concurrent `binding_arc` observes a dangling pointer.
                unsafe {
                    glib::gobject_ffi::g_object_set_qdata(
                        gobject,
                        self.quark().into_glib(),
                        std::ptr::null_mut(),
                    );
                    drop(Arc::from_raw(Arc::as_ptr(&binding)));
                }
            }
            Self::invoke_ref_op(ref_ptr, RefOp::Delete);
            // SAFETY: removes the exact `on_toggle_notify` toggle reference registered by
            // `install` on the still-live `gobject`, balancing the earlier add.
            unsafe {
                glib::gobject_ffi::g_object_remove_toggle_ref(
                    gobject,
                    Some(on_toggle_notify),
                    std::ptr::null_mut(),
                );
            }
        });
    }
}

/// # Safety
///
/// `instance` must be null or point to a live GObject-derived instance; this only forwards to
/// glib's `instance_of`, which checks the instance's type without taking ownership.
unsafe fn is_gobject(instance: *mut glib::gobject_ffi::GObject) -> bool {
    // SAFETY: forwards the caller's live-instance guarantee to glib's type check.
    unsafe { glib::types::instance_of::<glib::Object>(instance.cast()) }
}

/// `GObject` toggle-reference notify callback bridging `GObject`'s last-reference state to the
/// wrapper's strong/weak napi reference.
///
/// # Safety
///
/// Invoked by `GObject` whenever the toggle reference registered in `install` flips. `gobject` is
/// the live object that owns this toggle ref, and `_data` is the null user-data passed at
/// registration. Must only access `gobject` through the registry's serialized lookups.
unsafe extern "C" fn on_toggle_notify(
    _data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    let registry = WrapperRegistry::global();
    if glib::MainContext::default().is_owner() {
        // SAFETY: on the gtkx-glib thread with the live `gobject` from GObject; `binding_ptr`
        // returns this object's binding or null.
        let binding = unsafe { registry.binding_ptr(gobject) };
        if binding.is_null() {
            return;
        }
        // SAFETY: `binding` is non-null and kept alive by this object's toggle ref while the
        // callback runs; borrowing it to read its atomics is sound.
        let binding = unsafe { &*binding };
        let ref_ptr = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
        if ref_ptr.is_null() {
            return;
        }
        WrapperRegistry::apply_wrapper_level(binding, ref_ptr, is_last_ref == 0);
        return;
    }

    // SAFETY: off the gtkx-glib thread; `binding_arc` takes the live `gobject` and returns an
    // owned `Arc` clone under the registry lock, keeping the binding alive for the deferred task.
    let Some(binding) = (unsafe { registry.binding_arc(gobject) }) else {
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
        // SAFETY: this deferred task runs on the gtkx-glib thread; the non-zero generation check
        // above means the binding (and thus its toggle ref keeping `gobject` alive) is still
        // valid, so reading the object's `ref_count` field is sound.
        let ref_count = unsafe { (*gobject).ref_count };
        WrapperRegistry::apply_wrapper_level(&binding, ref_ptr, ref_count > 1);
    }));
}
