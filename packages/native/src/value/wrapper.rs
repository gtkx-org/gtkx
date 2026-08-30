use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr::NonNull;
use std::rc::Rc;

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::bindgen_prelude::*;
use napi::{Env, sys};

use crate::handle::surface;
use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;

pub struct WrapperHandle {
    dispatch: node_env::DispatchHandle,
    env: sys::napi_env,
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
    if napi_ref.is_null() {
        return;
    }
    if handle.wrapper_strong.replace(strong) == strong {
        return;
    }
    let mut count: u32 = 0;
    unsafe {
        if strong {
            sys::napi_reference_ref(handle.env, napi_ref, &raw mut count);
        } else {
            sys::napi_reference_unref(handle.env, napi_ref, &raw mut count);
        }
    }
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject` that the caller holds a strong
/// reference to for the duration of the call. It must be called on the thread `install` ran on:
/// the handle stored in the object's qdata is an `Rc` and is not safe to reach from any other
/// thread.
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
/// on, because the qdata it inspects holds a non-`Send` `Rc`. The returned object borrows the
/// environment and stays valid only for the current native call.
pub unsafe fn wrapper_value(
    env: &Env,
    gobject: *mut glib::gobject_ffi::GObject,
) -> Option<Object<'_>> {
    let napi_ref = unsafe { wrapper_ref(gobject) };

    if napi_ref.is_null() {
        return None;
    }

    let mut raw_value: sys::napi_value = std::ptr::null_mut();
    unsafe { sys::napi_get_reference_value(env.raw(), napi_ref, &raw mut raw_value) };

    if raw_value.is_null() {
        return None;
    }

    unsafe { Object::from_napi_value(env.raw(), raw_value) }.ok()
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject` that the caller holds a strong
/// reference to for the duration of the call, and the call must happen on the thread `install` ran
/// on, because the qdata it inspects holds a non-`Send` `Rc`.
pub unsafe fn has_wrapper(gobject: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { handle_qdata(gobject) }.is_some()
}

fn release_outgoing_ref(env: sys::napi_env, napi_ref: sys::napi_ref, was_strong: bool) {
    if napi_ref.is_null() || !was_strong {
        return;
    }
    let mut count: u32 = 0;
    unsafe { sys::napi_reference_unref(env, napi_ref, &raw mut count) };
}

/// # Safety
///
/// `gobject` must be a non-null pointer to a live `GObject`, and the caller must hold a strong
/// reference to it across the call, as `g_object_add_toggle_ref` requires. `napi_ref` must be a
/// live reference created in the Node environment installed on the current thread, with one
/// reference count handed over to the wrapper. The call must happen on the thread the Node
/// environment is installed on, since it stores a non-`Send` `Rc` in the object's qdata and
/// registers a toggle reference whose notify callback resyncs against this thread.
pub unsafe fn install(
    env: sys::napi_env,
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: sys::napi_ref,
) -> (Rc<WrapperHandle>, u64) {
    if let Some(nn) = unsafe { handle_qdata(gobject) } {
        let handle = unsafe { nn.as_ref() };
        let generation = handle.generation.get() + 1;
        let outgoing = handle.napi_ref.replace(napi_ref);
        let outgoing_was_strong = handle.wrapper_strong.replace(true);
        handle.generation.set(generation);
        release_outgoing_ref(handle.env, outgoing, outgoing_was_strong);
        (Rc::clone(handle), generation)
    } else {
        let handle = Rc::new(WrapperHandle {
            dispatch: node_env::dispatch_handle(),
            env,
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
                handle.dispatch.data(),
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
) {
    if let Some(handle) = &handle
        && handle.generation.get() == generation
    {
        handle.napi_ref.set(std::ptr::null_mut());
    }
    node_env::defer_local("wrapper cleanup", move || {
        let Some(handle) = handle else {
            return;
        };

        if handle.generation.get() != generation {
            return;
        }

        handle.generation.set(0);
        LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
            live.remove(&(gobject as usize));
        });
        unsafe {
            drop(borrow_object(gobject).steal_qdata::<Rc<WrapperHandle>>(quark()));
        }
        let borrowed = unsafe { borrow_object(gobject) };
        let doomed_surface = surface::awaits_destroy(&borrowed).then(|| (*borrowed).clone());
        unsafe {
            glib::gobject_ffi::g_object_remove_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                handle.dispatch.data(),
            );
        }
        if let Some(object) = doomed_surface {
            surface::release(object);
        }
    });
}

unsafe extern "C" fn on_toggle_notify(
    data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    let Some(dispatch) = node_env::dispatch_handle_for(data) else {
        return;
    };
    if dispatch.is_current_thread() {
        guard_ffi_boundary("toggle-reference notify", || unsafe {
            apply_toggle(gobject, is_last_ref == 0);
        });
        return;
    }

    let gobject_ptr = gobject as usize;
    dispatch.invoke("toggle-reference resync", move || {
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
