use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr::NonNull;
use std::rc::Rc;

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::sys;

use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;

pub struct WrapperHandle {
    napi_ref: Cell<sys::napi_ref>,
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

unsafe fn handle_qdata(
    gobject: *mut glib::gobject_ffi::GObject,
) -> Option<NonNull<Rc<WrapperHandle>>> {
    unsafe { borrow_object(gobject).qdata::<Rc<WrapperHandle>>(quark()) }
}

fn apply_wrapper_level(handle: &WrapperHandle, napi_ref: sys::napi_ref, strong: bool) {
    if handle.wrapper_strong.replace(strong) == strong {
        return;
    }
    let mut count: u32 = 0;
    unsafe {
        if strong {
            sys::napi_reference_ref(node_env::env().raw(), napi_ref, &raw mut count);
        } else {
            sys::napi_reference_unref(node_env::env().raw(), napi_ref, &raw mut count);
        }
    }
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject` that the caller holds a strong
/// reference to for the duration of the call. It must be called on the thread `install` ran on:
/// the handle stored in the object's qdata is an `Rc` and is not safe to reach from any other
/// thread. The returned `napi_ref` is null when no wrapper is installed, and otherwise stays valid
/// only until `schedule_cleanup` deletes it.
pub unsafe fn wrapper_ref(gobject: *mut glib::gobject_ffi::GObject) -> sys::napi_ref {
    match unsafe { handle_qdata(gobject) } {
        Some(nn) => unsafe { nn.as_ref() }.napi_ref.get(),
        None => std::ptr::null_mut(),
    }
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject` that the caller holds a strong
/// reference to for the duration of the call, and the call must happen on the thread `install` ran
/// on, because the qdata it inspects holds a non-`Send` `Rc`.
pub unsafe fn has_wrapper(gobject: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { handle_qdata(gobject) }.is_some()
}

fn delete_reference(napi_ref: sys::napi_ref) {
    unsafe { sys::napi_delete_reference(node_env::env().raw(), napi_ref) };
}

fn release_outgoing_ref(napi_ref: sys::napi_ref, was_strong: bool) {
    if napi_ref.is_null() || !was_strong {
        return;
    }
    let mut count: u32 = 0;
    unsafe { sys::napi_reference_unref(node_env::env().raw(), napi_ref, &raw mut count) };
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject`, and the caller must hold a strong
/// reference to it across the call, as `g_object_add_toggle_ref` requires. `napi_ref` must be a
/// live reference created in the Node environment installed on the current thread, with one
/// reference count handed over to the wrapper: the caller must not delete it, `schedule_cleanup`
/// does. The call must happen on the thread the Node environment is installed on, since it stores a
/// non-`Send` `Rc` in the object's qdata and registers a toggle reference whose notify callback
/// resyncs against this thread.
pub unsafe fn install(
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: sys::napi_ref,
) -> (Rc<WrapperHandle>, u64) {
    if let Some(nn) = unsafe { handle_qdata(gobject) } {
        let handle = unsafe { nn.as_ref() };
        let generation = handle.generation.get() + 1;
        let outgoing = handle.napi_ref.replace(napi_ref);
        let outgoing_was_strong = handle.wrapper_strong.replace(true);
        handle.generation.set(generation);
        release_outgoing_ref(outgoing, outgoing_was_strong);
        (Rc::clone(handle), generation)
    } else {
        let handle = Rc::new(WrapperHandle {
            napi_ref: Cell::new(napi_ref),
            generation: Cell::new(1),
            wrapper_strong: Cell::new(true),
        });
        unsafe {
            borrow_object(gobject).set_qdata::<Rc<WrapperHandle>>(quark(), Rc::clone(&handle));
        }
        LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
            live.insert(gobject as usize);
        });
        unsafe {
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                std::ptr::null_mut(),
            );
        }
        (handle, 1)
    }
}

/// # Safety
///
/// `gobject` must be null, or a pointer to a `GObject` that stays live until the idle callback
/// this queues has run: the wrapper's own toggle reference keeps it alive until this removes it.
/// It must be called on the thread `install` ran on, whose main context dispatches the callback,
/// because the qdata it steals holds a non-`Send` `Rc`.
pub unsafe fn schedule_cleanup(
    handle: Option<Rc<WrapperHandle>>,
    generation: u64,
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: sys::napi_ref,
) {
    glib::idle_add_local_once(move || {
        guard_ffi_boundary("wrapper cleanup", || {
            let Some(handle) = handle else {
                delete_reference(napi_ref);
                return;
            };

            if handle.generation.get() != generation {
                delete_reference(napi_ref);
                return;
            }

            handle.generation.set(0);
            LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
                live.remove(&(gobject as usize));
            });
            unsafe {
                drop(borrow_object(gobject).steal_qdata::<Rc<WrapperHandle>>(quark()));
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
    let Some(nn) = (unsafe { handle_qdata(gobject) }) else {
        return;
    };
    let handle = unsafe { nn.as_ref() };
    let napi_ref = handle.napi_ref.get();
    apply_wrapper_level(handle, napi_ref, strong);
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
    use test_support::napi_mock;

    use super::*;

    fn release_wrapper(handle: &Rc<WrapperHandle>, gobject: *mut glib::gobject_ffi::GObject) {
        unsafe {
            schedule_cleanup(
                Some(Rc::clone(handle)),
                handle.generation.get(),
                gobject,
                handle.napi_ref.get(),
            );
        }
        test_support::pump_default_context_until(|| !unsafe { has_wrapper(gobject) });
    }

    #[test]
    fn wrapper_ref_and_has_wrapper_are_empty_without_a_handle() {
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
            let (handle, generation) = unsafe { install(obj_ptr, napi_ref) };
            assert_eq!(generation, 1);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, napi_ref);
            assert!(unsafe { has_wrapper(obj_ptr) });
            release_wrapper(&handle, obj_ptr);
            drop(obj);
        });
    }

    #[test]
    fn reinstalling_bumps_the_generation_and_updates_the_reference() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let first_ref = napi_mock::fake_reference();
            let second_ref = napi_mock::fake_reference();
            let (_first, first_generation) = unsafe { install(obj_ptr, first_ref) };
            let (second, second_generation) = unsafe { install(obj_ptr, second_ref) };
            assert_eq!(first_generation, 1);
            assert_eq!(second_generation, 2);
            assert_eq!(unsafe { wrapper_ref(obj_ptr) }, second_ref);
            release_wrapper(&second, obj_ptr);
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_stale_generation_keeps_the_handle() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let napi_ref = napi_mock::fake_reference();
            let (handle, _) = unsafe { install(obj_ptr, napi_ref) };
            unsafe { schedule_cleanup(Some(Rc::clone(&handle)), 999, obj_ptr, napi_ref) };
            test_support::pump_default_context_until(|| false);
            assert!(unsafe { has_wrapper(obj_ptr) });
            release_wrapper(&handle, obj_ptr);
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_with_a_matching_generation_removes_the_handle() {
        node_env::run_installed(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let napi_ref = napi_mock::fake_reference();
            let (handle, generation) = unsafe { install(obj_ptr, napi_ref) };
            unsafe { schedule_cleanup(Some(handle), generation, obj_ptr, napi_ref) };
            test_support::pump_default_context_until(|| !unsafe { has_wrapper(obj_ptr) });
            assert!(!unsafe { has_wrapper(obj_ptr) });
            assert!(napi_mock::reference_is_deleted(napi_ref));
            drop(obj);
        });
    }

    #[test]
    fn schedule_cleanup_without_a_handle_deletes_the_reference() {
        node_env::run_installed(|| {
            let napi_ref = napi_mock::fake_reference();
            unsafe { schedule_cleanup(None, 0, std::ptr::null_mut(), napi_ref) };
            test_support::pump_default_context_until(|| napi_mock::reference_is_deleted(napi_ref));
            assert!(napi_mock::reference_is_deleted(napi_ref));
        });
    }
}
