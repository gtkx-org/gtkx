use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr::NonNull;
use std::rc::Rc;

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::sys;

use crate::messaging::node_env;
use crate::messaging::panic_handler::guard_ffi_boundary;

pub struct WrapperBinding {
    napi_ref: Cell<usize>,
    generation: Cell<u64>,
    wrapper_strong: Cell<bool>,
}

thread_local! {
    static LIVE_TOGGLE_REFS: RefCell<HashSet<usize>> = RefCell::new(HashSet::new());
}

fn quark() -> glib::Quark {
    glib::Quark::from_static_str(glib::gstr!("gtkx-wrapper-ref"))
}

unsafe fn borrow_object(gobject: *mut glib::gobject_ffi::GObject) -> Borrowed<glib::Object> {
    unsafe { from_glib_borrow(gobject) }
}

unsafe fn binding_qdata(
    gobject: *mut glib::gobject_ffi::GObject,
) -> Option<NonNull<Rc<WrapperBinding>>> {
    unsafe { borrow_object(gobject).qdata::<Rc<WrapperBinding>>(quark()) }
}

fn apply_wrapper_level(binding: &WrapperBinding, napi_ref: *mut c_void, strong: bool) {
    if binding.wrapper_strong.replace(strong) == strong {
        return;
    }
    let raw_ref = napi_ref as usize as sys::napi_ref;
    let mut count: u32 = 0;
    unsafe {
        if strong {
            sys::napi_reference_ref(node_env::env().raw(), raw_ref, &mut count);
        } else {
            sys::napi_reference_unref(node_env::env().raw(), raw_ref, &mut count);
        }
    }
}

pub unsafe fn wrapper_ref(gobject: *mut glib::gobject_ffi::GObject) -> *mut c_void {
    match unsafe { binding_qdata(gobject) } {
        Some(nn) => unsafe { nn.as_ref() }.napi_ref.get() as *mut c_void,
        None => std::ptr::null_mut(),
    }
}

pub unsafe fn has_wrapper(gobject: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { binding_qdata(gobject) }.is_some()
}

fn delete_reference(napi_ref: usize) {
    unsafe { sys::napi_delete_reference(node_env::env().raw(), napi_ref as sys::napi_ref) };
}

pub unsafe fn install(
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: *mut c_void,
) -> (Rc<WrapperBinding>, u64) {
    unsafe {
        if let Some(nn) = binding_qdata(gobject) {
            let binding = nn.as_ref();
            let generation = binding.generation.get() + 1;
            binding.napi_ref.set(napi_ref as usize);
            binding.generation.set(generation);
            binding.wrapper_strong.set(true);
            (Rc::clone(binding), generation)
        } else {
            let binding = Rc::new(WrapperBinding {
                napi_ref: Cell::new(napi_ref as usize),
                generation: Cell::new(1),
                wrapper_strong: Cell::new(true),
            });
            borrow_object(gobject).set_qdata::<Rc<WrapperBinding>>(quark(), Rc::clone(&binding));
            LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
                live.insert(gobject as usize);
            });
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
            (binding, 1)
        }
    }
}

pub(crate) fn schedule_cleanup(
    binding: Option<Rc<WrapperBinding>>,
    generation: u64,
    gobject_ptr: usize,
    napi_ref: usize,
) {
    glib::idle_add_local_once(move || {
        guard_ffi_boundary("wrapper cleanup", || {
            let Some(binding) = binding else {
                delete_reference(napi_ref);
                return;
            };

            if binding.generation.get() != generation {
                delete_reference(napi_ref);
                return;
            }

            let gobject = gobject_ptr as *mut glib::gobject_ffi::GObject;
            binding.generation.set(0);
            LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
                live.remove(&gobject_ptr);
            });
            unsafe {
                drop(borrow_object(gobject).steal_qdata::<Rc<WrapperBinding>>(quark()));
            }
            delete_reference(napi_ref);
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
    if node_env::is_installed_on_current_thread() {
        guard_ffi_boundary("toggle-reference notify", || unsafe {
            apply_toggle(gobject, is_last_ref == 0);
        });
        return;
    }

    let gobject_ptr = gobject as usize;
    node_env::invoke_on_install_thread("toggle-reference resync", move || {
        resync_wrapper_level(gobject_ptr);
    });
}

unsafe fn apply_toggle(gobject: *mut glib::gobject_ffi::GObject, strong: bool) {
    let Some(nn) = (unsafe { binding_qdata(gobject) }) else {
        return;
    };
    let binding = unsafe { nn.as_ref() };
    let napi_ref = binding.napi_ref.get() as *mut c_void;
    apply_wrapper_level(binding, napi_ref, strong);
}

fn resync_wrapper_level(gobject_ptr: usize) {
    if !LIVE_TOGGLE_REFS.with_borrow(|live| live.contains(&gobject_ptr)) {
        return;
    }
    let gobject = gobject_ptr as *mut glib::gobject_ffi::GObject;
    let strong = unsafe { borrow_object(gobject) }.ref_count() > 1;
    unsafe { apply_toggle(gobject, strong) };
}

#[cfg(test)]
mod tests {
    use super::*;

    use test_support::napi_mock;

    #[test]
    fn wrapper_ref_and_has_wrapper_are_empty_without_a_binding() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            assert!(unsafe { wrapper_ref(obj_ptr).is_null() });
            assert!(!unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn install_records_the_reference_and_marks_the_object_wrapped() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let napi_ref = napi_mock::fake_reference();
            let (_binding, generation) = unsafe { install(obj_ptr, napi_ref.cast()) };
            assert_eq!(generation, 1);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, napi_ref.cast());
            assert!(unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn reinstalling_bumps_the_generation_and_updates_the_reference() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let first_ref = napi_mock::fake_reference();
            let second_ref = napi_mock::fake_reference();
            let (_first, first_generation) = unsafe { install(obj_ptr, first_ref.cast()) };
            let (_second, second_generation) = unsafe { install(obj_ptr, second_ref.cast()) };
            assert_eq!(first_generation, 1);
            assert_eq!(second_generation, 2);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, second_ref.cast());
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_stale_generation_keeps_the_binding() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let napi_ref = napi_mock::fake_reference();
            let (binding, _) = unsafe { install(obj_ptr, napi_ref.cast()) };
            schedule_cleanup(Some(binding), 999, obj_ptr as usize, napi_ref as usize);
            test_support::pump_default_context_until(|| false);
            assert!(unsafe { has_wrapper(obj_ptr) });
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_matching_generation_removes_the_binding() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let napi_ref = napi_mock::fake_reference();
            let (binding, generation) = unsafe { install(obj_ptr, napi_ref.cast()) };
            schedule_cleanup(
                Some(binding),
                generation,
                obj_ptr as usize,
                napi_ref as usize,
            );
            test_support::pump_default_context_until(|| !unsafe { has_wrapper(obj_ptr) });
            assert!(!unsafe { has_wrapper(obj_ptr) });
            assert!(napi_mock::reference_is_deleted(napi_ref));
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_without_a_binding_deletes_the_reference() {
        node_env::run_installed(|| {
            let napi_ref = napi_mock::fake_reference();
            schedule_cleanup(None, 0, 0, napi_ref as usize);
            test_support::pump_default_context_until(|| napi_mock::reference_is_deleted(napi_ref));
            assert!(napi_mock::reference_is_deleted(napi_ref));
        });
    }
}
