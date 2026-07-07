use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};

use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::panic_handler::guard_ffi_boundary;
use crate::messaging::{LockExt as _, Mailbox, WrapperRefOp};

pub struct WrapperBinding {
    napi_ref: AtomicUsize,
    generation: AtomicU64,
    wrapper_strong: AtomicBool,
}

static QUARK: OnceLock<glib::Quark> = OnceLock::new();
static LOOKUP_LOCK: Mutex<()> = Mutex::new(());

fn quark() -> glib::Quark {
    *QUARK.get_or_init(|| glib::Quark::from_static_str(glib::gstr!("gtkx-wrapper-ref")))
}

unsafe fn borrow_object(gobject: *mut glib::gobject_ffi::GObject) -> Borrowed<glib::Object> {
    unsafe { from_glib_borrow(gobject) }
}

unsafe fn binding_qdata(
    gobject: *mut glib::gobject_ffi::GObject,
) -> Option<NonNull<Arc<WrapperBinding>>> {
    unsafe { borrow_object(gobject).qdata::<Arc<WrapperBinding>>(quark()) }
}

unsafe fn binding_arc(gobject: *mut glib::gobject_ffi::GObject) -> Option<Arc<WrapperBinding>> {
    let _serialized = LOOKUP_LOCK.lock_unpoison();
    unsafe { binding_qdata(gobject) }.map(|nn| Arc::clone(unsafe { nn.as_ref() }))
}

fn apply_wrapper_level(binding: &WrapperBinding, napi_ref: *mut c_void, strong: bool) {
    if binding.wrapper_strong.swap(strong, Ordering::AcqRel) == strong {
        return;
    }
    let op = if strong {
        WrapperRefOp::Ref
    } else {
        WrapperRefOp::Unref
    };
    invoke_ref_op(napi_ref, op);
}

pub unsafe fn wrapper_ref(gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
    match unsafe { binding_qdata(gobject) } {
        Some(nn) => unsafe { nn.as_ref() }.napi_ref.load(Ordering::Relaxed) as *mut c_void,
        None => std::ptr::null_mut(),
    }
}

pub unsafe fn has_wrapper(gobject: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { binding_qdata(gobject) }.is_some()
}

fn invoke_ref_op(napi_ref: *mut c_void, op: WrapperRefOp) {
    let mailbox = Mailbox::global();
    if mailbox.is_not_running() {
        return;
    }
    match op {
        WrapperRefOp::Unref => mailbox.schedule_wrapper_unref(napi_ref as usize),
        WrapperRefOp::Ref => {
            if let Err(error) = mailbox.apply_wrapper_ref_op_and_wait(napi_ref as usize, op) {
                ErrorReporter::global().report(&error.context(
                    "toggle-reference operation failed; wrapper lifetime state may be inconsistent",
                ));
            }
        }
    }
}

fn schedule_reference_delete(napi_ref: usize) {
    let mailbox = Mailbox::global();
    if mailbox.is_not_running() {
        return;
    }
    mailbox.schedule_wrapper_ref_delete(napi_ref);
}

pub(crate) unsafe fn install(
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: *mut c_void,
    consume_pending: bool,
) -> (Arc<WrapperBinding>, u64) {
    unsafe {
        let result = if let Some(nn) = binding_qdata(gobject) {
            let binding = nn.as_ref();
            let generation = binding.generation.load(Ordering::Relaxed) + 1;
            binding.napi_ref.store(napi_ref as usize, Ordering::Relaxed);
            binding.generation.store(generation, Ordering::Relaxed);
            binding.wrapper_strong.store(true, Ordering::Release);
            (Arc::clone(binding), generation)
        } else {
            let binding = Arc::new(WrapperBinding {
                napi_ref: AtomicUsize::new(napi_ref as usize),
                generation: AtomicU64::new(1),
                wrapper_strong: AtomicBool::new(true),
            });
            borrow_object(gobject).set_qdata::<Arc<WrapperBinding>>(quark(), Arc::clone(&binding));
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
            (binding, 1)
        };
        if consume_pending {
            glib::gobject_ffi::g_object_unref(gobject);
        }
        result
    }
}

pub(crate) fn schedule_cleanup(
    binding: Option<Arc<WrapperBinding>>,
    generation: u64,
    gobject_ptr: usize,
    napi_ref: usize,
) {
    if Mailbox::global().is_not_running() {
        return;
    }
    glib::idle_add_once(move || {
        guard_ffi_boundary("wrapper cleanup", || {
            let Some(binding) = binding else {
                schedule_reference_delete(napi_ref);
                return;
            };

            if binding.generation.load(Ordering::Relaxed) != generation {
                schedule_reference_delete(napi_ref);
                return;
            }

            let gobject = gobject_ptr as *mut glib::gobject_ffi::GObject;
            binding.generation.store(0, Ordering::Relaxed);
            {
                let _serialized = LOOKUP_LOCK.lock_unpoison();
                unsafe {
                    drop(borrow_object(gobject).steal_qdata::<Arc<WrapperBinding>>(quark()));
                }
            }
            schedule_reference_delete(napi_ref);
            unsafe {
                glib::gobject_ffi::g_object_remove_toggle_ref(
                    gobject,
                    Some(on_toggle_notify),
                    std::ptr::null_mut(),
                );
            }
        });
    });
}

unsafe extern "C" fn on_toggle_notify(
    _data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    guard_ffi_boundary("toggle-reference notify", || {
        if glib::MainContext::default().is_owner() {
            let Some(nn) = (unsafe { binding_qdata(gobject) }) else {
                return;
            };
            let binding = unsafe { nn.as_ref() };
            let napi_ref = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
            apply_wrapper_level(binding, napi_ref, is_last_ref == 0);
            return;
        }

        let Some(binding) = (unsafe { binding_arc(gobject) }) else {
            return;
        };
        let gobject_ptr = gobject as usize;
        Mailbox::global().schedule_glib(Box::new(move || {
            if binding.generation.load(Ordering::Relaxed) == 0 {
                return;
            }
            let napi_ref = binding.napi_ref.load(Ordering::Relaxed) as *mut c_void;
            let gobject = gobject_ptr as *mut glib::gobject_ffi::GObject;
            let ref_count = unsafe { borrow_object(gobject).ref_count() };
            apply_wrapper_level(&binding, napi_ref, ref_count > 1);
        }));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sentinel(value: usize) -> *mut c_void {
        value as *mut c_void
    }

    #[test]
    fn wrapper_ref_and_has_wrapper_are_empty_without_a_binding() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            assert!(unsafe { wrapper_ref(obj_ptr).is_null() });
            assert!(!unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn install_records_the_reference_and_marks_the_object_wrapped() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let (_binding, generation) = unsafe { install(obj_ptr, sentinel(0x1234), false) };
            assert_eq!(generation, 1);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, sentinel(0x1234));
            assert!(unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn reinstalling_bumps_the_generation_and_updates_the_reference() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let (_first, first_generation) = unsafe { install(obj_ptr, sentinel(0x11), false) };
            let (_second, second_generation) = unsafe { install(obj_ptr, sentinel(0x22), false) };
            assert_eq!(first_generation, 1);
            assert_eq!(second_generation, 2);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, sentinel(0x22));
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_stale_generation_keeps_the_binding() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let (binding, _) = unsafe { install(obj_ptr, sentinel(0x1), false) };
            schedule_cleanup(Some(binding), 999, obj_ptr as usize, 0x1);
            test_support::pump_default_context_until(|| false);
            assert!(unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_matching_generation_removes_the_binding() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let (binding, generation) = unsafe { install(obj_ptr, sentinel(0x1), false) };
            schedule_cleanup(Some(binding), generation, obj_ptr as usize, 0x1);
            test_support::pump_default_context_until(|| !unsafe { has_wrapper(obj_ptr) });
            assert!(!unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_without_a_binding_is_a_noop() {
        test_support::run(|| {
            schedule_cleanup(None, 0, 0, 0x5);
            test_support::pump_default_context_until(|| false);
        });
    }
}
