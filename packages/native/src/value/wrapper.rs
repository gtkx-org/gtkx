use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::c_void;
use std::ptr::NonNull;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock, Mutex};

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::bindgen_prelude::*;
use napi::{Env, sys};

use crate::handle::surface;
use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;
use crate::host::release_queue::{self, Owner};

pub struct WrapperHandle {
    napi_ref: Cell<sys::napi_ref>,
    generation: Cell<u64>,
    wrapper_strong: Cell<bool>,
    notification_id: usize,
}

impl WrapperHandle {
    pub(crate) fn is_reachable(&self) -> bool {
        if self.napi_ref.get().is_null() {
            return false;
        }
        let mut value = std::ptr::null_mut();
        unsafe {
            sys::napi_get_reference_value(
                node_env::env().raw(),
                self.napi_ref.get(),
                &raw mut value,
            );
        }
        !value.is_null()
    }
}

pub(crate) unsafe fn track_handle(
    gobject: *mut glib::gobject_ffi::GObject,
    handle: &crate::handle::Handle,
) {
    if let Some(wrapper) = unsafe { handle_qdata(gobject) } {
        handle.track_wrapper(unsafe { wrapper.as_ref() });
    }
}

thread_local! {
    static LIVE_TOGGLE_REFS: RefCell<HashMap<usize, usize>> = RefCell::new(HashMap::new());
}

static NEXT_NOTIFICATION: AtomicUsize = AtomicUsize::new(1);
static TOGGLE_OWNERS: LazyLock<Mutex<HashMap<usize, Arc<Owner>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn register_toggle_owner() -> usize {
    let id = NEXT_NOTIFICATION
        .try_update(Ordering::Relaxed, Ordering::Relaxed, |id| id.checked_add(1))
        .expect("toggle notification identities exhausted");
    TOGGLE_OWNERS
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .insert(id, release_queue::owner());
    id
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
    if napi_ref.is_null() || handle.wrapper_strong.replace(strong) == strong {
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
            notification_id: register_toggle_owner(),
        });
        unsafe {
            borrow_object(gobject).set_qdata::<Rc<WrapperHandle>>(quark(), Rc::clone(&handle));
        }
        LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
            live.insert(gobject as usize, handle.notification_id);
        });
        unsafe {
            glib::gobject_ffi::g_object_add_toggle_ref(
                gobject,
                Some(on_toggle_notify),
                toggle_data(&handle),
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
    env: sys::napi_env,
    handle: Option<Rc<WrapperHandle>>,
    generation: u64,
    gobject: *mut glib::gobject_ffi::GObject,
    napi_ref: sys::napi_ref,
) {
    if let Some(handle) = &handle
        && handle.generation.get() == generation
    {
        handle.napi_ref.set(std::ptr::null_mut());
        handle.wrapper_strong.set(false);
    }
    unsafe { sys::napi_delete_reference(env, napi_ref) };
    release_queue::defer(move || {
        let Some(handle) = handle else {
            return;
        };
        if handle.generation.get() != generation {
            return;
        }
        handle.generation.set(0);
        TOGGLE_OWNERS
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(&handle.notification_id);
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
                toggle_data(&handle),
            );
        }
        if let Some(object) = doomed_surface {
            surface::release(object);
        }
    });
}

fn toggle_data(handle: &WrapperHandle) -> *mut c_void {
    handle.notification_id as *mut c_void
}

unsafe extern "C" fn on_toggle_notify(
    data: *mut c_void,
    gobject: *mut glib::gobject_ffi::GObject,
    is_last_ref: glib::ffi::gboolean,
) {
    guard_ffi_boundary("toggle-reference notify", || {
        let notification_id = data as usize;
        let owner = TOGGLE_OWNERS
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(&notification_id)
            .cloned();
        let Some(owner) = owner else {
            return;
        };
        if owner.is_current_thread() {
            if release_queue::is_retiring()
                || !LIVE_TOGGLE_REFS
                    .with_borrow(|live| live.get(&(gobject as usize)) == Some(&notification_id))
            {
                return;
            }
            unsafe { apply_toggle(gobject, is_last_ref == 0) };
            return;
        }

        let gobject_ptr = gobject as usize;
        owner.invoke("toggle-reference resync", move || {
            resync_wrapper_level(gobject_ptr, notification_id);
        });
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

fn resync_wrapper_level(gobject_ptr: usize, notification_id: usize) {
    if release_queue::is_retiring() {
        return;
    }
    if !LIVE_TOGGLE_REFS.with_borrow(|live| live.get(&gobject_ptr) == Some(&notification_id)) {
        return;
    }
    let gobject = gobject_ptr as *mut glib::gobject_ffi::GObject;
    let strong = unsafe { borrow_object(gobject) }.ref_count() > 1;
    unsafe { apply_toggle(gobject, strong) };
}
