#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};

use glib::translate::IntoGlib as _;
use parking_lot::Mutex;

use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::{JsRefDeletion, Mailbox};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WrapperRefOp {
    Unref,
    Ref,
}

impl WrapperRefOp {
    pub(crate) fn apply(self, env: &napi::Env, ref_ptr: usize) {
        use napi::sys;

        let raw_ref = ref_ptr as sys::napi_ref;
        let mut count: u32 = 0;
        unsafe {
            match self {
                Self::Ref => {
                    sys::napi_reference_ref(env.raw(), raw_ref, &mut count);
                }
                Self::Unref => {
                    sys::napi_reference_unref(env.raw(), raw_ref, &mut count);
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
            WrapperRefOp::Ref
        } else {
            WrapperRefOp::Unref
        };
        Self::invoke_ref_op(ref_ptr, op);
    }

    unsafe fn binding_ptr(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
    ) -> *const WrapperBinding {
        if gobject.is_null() || !unsafe { is_gobject(gobject) } {
            return std::ptr::null();
        }
        unsafe { glib::gobject_ffi::g_object_get_qdata(gobject, self.quark().into_glib()) }
            .cast::<WrapperBinding>()
    }

    unsafe fn binding_arc(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
    ) -> Option<Arc<WrapperBinding>> {
        let _serialized = self.lookup_lock.lock();
        let ptr = unsafe { self.binding_ptr(gobject) };
        if ptr.is_null() {
            return None;
        }
        unsafe {
            Arc::increment_strong_count(ptr);
            Some(Arc::from_raw(ptr))
        }
    }

    #[must_use]
    pub unsafe fn wrapper_ref(&self, gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
        let binding = unsafe { self.binding_ptr(gobject) };
        if binding.is_null() {
            return std::ptr::null_mut();
        }
        unsafe { (*binding).napi_ref.load(Ordering::Relaxed) as *mut c_void }
    }

    #[must_use]
    pub unsafe fn has_wrapper(&self, gobject: *mut glib::gobject_ffi::GObject) -> bool {
        !unsafe { self.binding_ptr(gobject) }.is_null()
    }

    fn invoke_ref_op(ref_ptr: *mut c_void, op: WrapperRefOp) {
        let mailbox = Mailbox::global();
        if mailbox.is_not_running() || !mailbox.is_initialized() {
            return;
        }
        if let Err(error) = mailbox.apply_wrapper_ref_op_and_wait(ref_ptr as usize, op) {
            ErrorReporter::global().report(&error.context(
                "toggle-reference operation failed; wrapper lifetime state may be inconsistent",
            ));
        }
    }

    fn schedule_reference_delete(env_addr: usize, ref_addr: usize) {
        let mailbox = Mailbox::global();
        if mailbox.is_not_running() {
            return;
        }
        mailbox.schedule_js_reference_delete(JsRefDeletion::new(
            env_addr as napi::sys::napi_env,
            ref_addr as napi::sys::napi_ref,
        ));
    }

    pub(crate) unsafe fn install(
        &self,
        gobject: *mut glib::gobject_ffi::GObject,
        ref_ptr: *mut c_void,
        consume_pending: bool,
    ) -> (Arc<WrapperBinding>, u64) {
        unsafe {
            let existing = self.binding_ptr(gobject);
            let result = if existing.is_null() {
                let cell = Arc::new(WrapperBinding {
                    napi_ref: AtomicUsize::new(ref_ptr as usize),
                    generation: AtomicU64::new(1),
                    wrapper_strong: AtomicBool::new(true),
                });
                glib::gobject_ffi::g_object_set_qdata(
                    gobject,
                    self.quark().into_glib(),
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

    pub(crate) fn schedule_cleanup(
        &'static self,
        env_addr: usize,
        binding: Option<Arc<WrapperBinding>>,
        generation: u64,
        gobject_addr: usize,
        ref_addr: usize,
    ) {
        if Mailbox::global().is_not_running() {
            return;
        }
        glib::idle_add_once(move || {
            let Some(binding) = binding else {
                Self::schedule_reference_delete(env_addr, ref_addr);
                return;
            };

            if binding.generation.load(Ordering::Relaxed) != generation {
                Self::schedule_reference_delete(env_addr, ref_addr);
                return;
            }

            let gobject = gobject_addr as *mut glib::gobject_ffi::GObject;
            binding.generation.store(0, Ordering::Relaxed);
            {
                let _serialized = self.lookup_lock.lock();
                unsafe {
                    glib::gobject_ffi::g_object_set_qdata(
                        gobject,
                        self.quark().into_glib(),
                        std::ptr::null_mut(),
                    );
                    drop(Arc::from_raw(Arc::as_ptr(&binding)));
                }
            }
            Self::schedule_reference_delete(env_addr, ref_addr);
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

unsafe fn is_gobject(instance: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { glib::types::instance_of::<glib::Object>(instance.cast()) }
}

unsafe extern "C" fn on_toggle_notify(
    _data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    let registry = WrapperRegistry::global();
    if glib::MainContext::default().is_owner() {
        let binding = unsafe { registry.binding_ptr(gobject) };
        if binding.is_null() {
            return;
        }
        let binding = unsafe { &*binding };
        let ref_ptr = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
        if ref_ptr.is_null() {
            return;
        }
        WrapperRegistry::apply_wrapper_level(binding, ref_ptr, is_last_ref == 0);
        return;
    }

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
        let ref_count = unsafe { (*gobject).ref_count };
        WrapperRegistry::apply_wrapper_level(&binding, ref_ptr, ref_count > 1);
    }));
}
