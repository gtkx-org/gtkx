use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::ptr::NonNull;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock, Mutex};

use glib::prelude::ObjectExt as _;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::bindgen_prelude::*;
use napi::{Env, sys};

use crate::handle::{Handle, surface};
use crate::host::callback_error::CallbackErrorScope;
use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;
use crate::host::release_queue::{self, Owner};
use crate::value::roots;

pub(crate) const BORROW_ROOT: &str = "wrapper-borrow";

pub struct WrapperHandle {
    napi_ref: Cell<sys::napi_ref>,
    generation: Cell<u64>,
    wrapper_strong: Cell<bool>,
    holds_toggle: Cell<bool>,
    notification_id: usize,
}

struct WrapperBorrow {
    id: usize,
    owner: usize,
    dependent: usize,
    owner_handle: Handle,
    dependent_handle: Handle,
    clear: Handle,
}

impl WrapperBorrow {
    fn clear(&self, env: &Env) -> Result<()> {
        let _owner_lease = crate::api::native_result(
            "clearing wrapper borrow",
            self.owner_handle.acquire_lease(),
        )?;
        let _dependent_lease = crate::api::native_result(
            "clearing wrapper borrow",
            self.dependent_handle.acquire_lease(),
        )?;
        let owner = self.owner_handle.as_gobject_ptr().ok_or_else(|| {
            Error::from_reason("The borrowed pointer owner is no longer a live GObject")
        })?;
        let clear = crate::api::native_result(
            "clearing wrapper borrow",
            self.clear.lifecycle_function_ptr(),
        )?;
        if let Some(wrapper) = unsafe { wrapper_value(env, owner) } {
            roots::remove(*env, wrapper.into_unknown(env)?, BORROW_ROOT)?;
        }
        let clear = unsafe {
            std::mem::transmute::<*mut c_void, unsafe extern "C" fn(*mut c_void, *mut c_void)>(
                clear,
            )
        };
        unsafe { clear(owner.cast(), std::ptr::null_mut()) };

        Ok(())
    }
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

pub(crate) unsafe fn track_handle(gobject: *mut glib::gobject_ffi::GObject, handle: &Handle) {
    if let Some(wrapper) = unsafe { handle_qdata(gobject) } {
        handle.track_wrapper(unsafe { wrapper.as_ref() });
    }
}

thread_local! {
    static LIVE_TOGGLE_REFS: RefCell<HashMap<usize, usize>> = RefCell::new(HashMap::new());
    static WRAPPER_BORROWS: RefCell<HashMap<usize, WrapperBorrow>> = RefCell::new(HashMap::new());
}

static NEXT_NOTIFICATION: AtomicUsize = AtomicUsize::new(1);
static NEXT_BORROW: AtomicUsize = AtomicUsize::new(1);
static TOGGLE_OWNERS: LazyLock<Mutex<HashMap<usize, Arc<Owner>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn next_identity(counter: &AtomicUsize) -> usize {
    counter
        .try_update(Ordering::Relaxed, Ordering::Relaxed, |id| id.checked_add(1))
        .expect("native identities exhausted")
}

fn register_toggle_owner() -> usize {
    let id = next_identity(&NEXT_NOTIFICATION);
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

pub(crate) unsafe fn active_identity(gobject: *mut glib::gobject_ffi::GObject) -> Option<usize> {
    let handle = unsafe { handle_qdata(gobject) }?;
    let handle = unsafe { handle.as_ref() };

    (!handle.napi_ref.get().is_null() && handle.generation.get() != 0 && handle.holds_toggle.get())
        .then_some(handle.notification_id)
}

pub(crate) fn set_borrow(
    owner: usize,
    dependent: usize,
    owner_handle: Handle,
    dependent_handle: Handle,
    clear: Handle,
) {
    let id = next_identity(&NEXT_BORROW);
    WRAPPER_BORROWS.with_borrow_mut(|borrows| {
        borrows.insert(
            owner,
            WrapperBorrow {
                id,
                owner,
                dependent,
                owner_handle,
                dependent_handle,
                clear,
            },
        );
    });
}

pub(crate) fn clear_borrow(owner: usize) {
    WRAPPER_BORROWS.with_borrow_mut(|borrows| {
        borrows.remove(&owner);
    });
}

pub(crate) fn retire_borrows() {
    WRAPPER_BORROWS.with_borrow_mut(HashMap::clear);
}

fn borrow_ids(identity: usize) -> Vec<(usize, usize)> {
    WRAPPER_BORROWS.with_borrow(|borrows| {
        borrows
            .iter()
            .filter_map(|(&owner, borrow)| {
                (owner == identity || borrow.dependent == identity).then_some((owner, borrow.id))
            })
            .collect()
    })
}

fn take_borrow(owner: usize, id: usize) -> Option<WrapperBorrow> {
    WRAPPER_BORROWS.with_borrow_mut(|borrows| {
        if borrows.get(&owner)?.id != id {
            return None;
        }

        borrows.remove(&owner)
    })
}

fn release_borrows(identity: usize) -> bool {
    for (owner, id) in borrow_ids(identity) {
        let Some(borrow) = take_borrow(owner, id) else {
            continue;
        };
        let mut succeeded = false;
        if node_env::try_env().is_some() {
            node_env::run_dispatch_scope(|| {
                let env = node_env::env();
                match borrow.clear(&env) {
                    Ok(()) => succeeded = true,
                    Err(error) => CallbackErrorScope::deliver(env, error),
                }
            });
        }
        if !succeeded {
            WRAPPER_BORROWS.with_borrow_mut(|borrows| {
                borrows.entry(borrow.owner).or_insert(borrow);
            });
            return false;
        }
    }

    true
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
        if handle.holds_toggle.get() {
            let generation = handle.generation.get() + 1;
            let outgoing = handle.napi_ref.replace(napi_ref);
            let outgoing_was_strong = handle.wrapper_strong.replace(true);
            handle.generation.set(generation);
            release_outgoing_ref(outgoing, outgoing_was_strong);
            return (Rc::clone(handle), generation);
        }
        unsafe {
            drop(borrow_object(gobject).steal_qdata::<Rc<WrapperHandle>>(quark()));
        }
    }
    let handle = Rc::new(WrapperHandle {
        napi_ref: Cell::new(napi_ref),
        generation: Cell::new(1),
        wrapper_strong: Cell::new(true),
        holds_toggle: Cell::new(true),
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
        if handle.generation.get() != generation || !handle.holds_toggle.get() {
            return;
        }
        if !release_borrows(handle.notification_id) {
            return;
        }
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

fn is_live_toggle(gobject: usize, notification_id: usize) -> bool {
    LIVE_TOGGLE_REFS.with_borrow(|live| live.get(&gobject) == Some(&notification_id))
}

/// Whether the wrapper's own toggle reference is the only reference left on `gobject`, while the
/// wrapper is still installed.
///
/// # Safety
///
/// `gobject` must be live, which holds for every object `LIVE_TOGGLE_REFS` lists, and the call
/// must happen on the thread `install` ran on.
unsafe fn is_unowned(gobject: usize, notification_id: usize) -> bool {
    let gobject = gobject as *mut glib::gobject_ffi::GObject;
    let Some(handle) = (unsafe { handle_qdata(gobject) }) else {
        return false;
    };
    let handle = unsafe { handle.as_ref() };
    let borrowed = unsafe { borrow_object(gobject) };

    handle.notification_id == notification_id
        && !handle.napi_ref.get().is_null()
        && handle.generation.get() != 0
        && borrowed.ref_count() == 1
        && !surface::awaits_destroy(&borrowed)
}

/// Drops the toggle reference of an object that native code still references, so it is disposed
/// when its native owners let it go, as in C, instead of when its wrapper is collected. The wrapper
/// stays installed and strongly held, so the object's JavaScript state outlives its disposal; a
/// later wrapper for an object that survives starts afresh.
///
/// # Safety
///
/// `gobject` must be live and listed in `LIVE_TOGGLE_REFS`, on the thread `install` ran on.
unsafe fn detach_owned(gobject: *mut glib::gobject_ffi::GObject) {
    let Some(handle) = (unsafe { handle_qdata(gobject) }) else {
        return;
    };
    let handle = Rc::clone(unsafe { handle.as_ref() });
    let object = unsafe { borrow_object(gobject) };
    if object.ref_count() < 2
        || surface::is_surface(&object)
        || !borrow_ids(handle.notification_id).is_empty()
    {
        return;
    }
    TOGGLE_OWNERS
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .remove(&handle.notification_id);
    LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
        live.remove(&(gobject as usize));
    });
    apply_wrapper_level(&handle, handle.napi_ref.get(), true);
    handle.holds_toggle.set(false);
    unsafe {
        glib::gobject_ffi::g_object_remove_toggle_ref(
            gobject,
            Some(on_toggle_notify),
            toggle_data(&handle),
        );
    }
}

fn detach_owned_objects() {
    let owned: Vec<_> = LIVE_TOGGLE_REFS.with_borrow(|live| {
        live.iter()
            .filter(|&(&gobject, _)| {
                unsafe { borrow_object(gobject as *mut glib::gobject_ffi::GObject) }.ref_count() > 1
            })
            .map(|(&gobject, &id)| (gobject, id))
            .collect()
    });
    for (gobject, id) in owned {
        if is_live_toggle(gobject, id) {
            unsafe { detach_owned(gobject as *mut glib::gobject_ffi::GObject) };
        }
    }
}

fn release_rank(gobject: usize, widget: Option<glib::Type>) -> u8 {
    let type_ = unsafe { borrow_object(gobject as *mut glib::gobject_ffi::GObject) }.type_();
    if widget.is_some_and(|widget| type_.is_a(widget)) {
        0
    } else if crate::api::register_class::is_registered_type(type_) {
        1
    } else {
        2
    }
}

/// The objects only their wrappers reference that come first in the release order, as
/// `(object, notification id)` pairs in the order they were first wrapped.
fn next_unowned_objects(visited: &HashSet<usize>) -> Vec<(usize, usize)> {
    let widget = glib::Type::from_name("GtkWidget");
    let mut ranked: Vec<_> = LIVE_TOGGLE_REFS.with_borrow(|live| {
        live.iter()
            .filter(|&(&gobject, &id)| !visited.contains(&id) && unsafe { is_unowned(gobject, id) })
            .map(|(&gobject, &id)| (release_rank(gobject, widget), id, gobject))
            .collect()
    });
    let Some(first) = ranked.iter().map(|&(rank, ..)| rank).min() else {
        return Vec::new();
    };
    ranked.retain(|&(rank, ..)| rank == first);
    ranked.sort_unstable_by_key(|&(_, id, _)| id);
    ranked
        .into_iter()
        .map(|(_, id, gobject)| (gobject, id))
        .collect()
}

/// Drops the toggle reference of an object that only its wrapper still references, which disposes
/// and finalizes it while JavaScript runs. The wrapper stays installed during disposal, so the
/// object's own JavaScript vfuncs and signal handlers still reach it, and is detached afterwards:
/// the JavaScript wrapper stays collectable and its handle reports the object as ended.
///
/// # Safety
///
/// `gobject` must be live and listed in `LIVE_TOGGLE_REFS`, on the thread `install` ran on.
unsafe fn release_unowned_object(gobject: *mut glib::gobject_ffi::GObject) {
    let Some(handle) = (unsafe { handle_qdata(gobject) }) else {
        return;
    };
    let handle = Rc::clone(unsafe { handle.as_ref() });
    let generation = handle.generation.get();
    if !release_borrows(handle.notification_id)
        || handle.generation.get() != generation
        || unsafe { borrow_object(gobject) }.ref_count() != 1
    {
        return;
    }
    let finalized = crate::handle::finalization_flag(&*unsafe { borrow_object(gobject) });
    TOGGLE_OWNERS
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .remove(&handle.notification_id);
    LIVE_TOGGLE_REFS.with_borrow_mut(|live| {
        live.remove(&(gobject as usize));
    });
    unsafe {
        glib::gobject_ffi::g_object_remove_toggle_ref(
            gobject,
            Some(on_toggle_notify),
            toggle_data(&handle),
        );
    }
    handle.holds_toggle.set(false);
    if !finalized.load(Ordering::Acquire) {
        unsafe {
            drop(borrow_object(gobject).steal_qdata::<Rc<WrapperHandle>>(quark()));
        }
    }
    let napi_ref = handle.napi_ref.replace(std::ptr::null_mut());
    release_outgoing_ref(napi_ref, handle.wrapper_strong.replace(false));
    handle.generation.set(0);
}

/// Gives up every toggle reference wrappers hold while JavaScript can still run, so teardown that
/// calls back into JavaScript, such as a view clearing a JavaScript list model or a subclass's
/// `vfuncDispose`, runs as it does during the application's run. Pending cleanup runs first.
/// Objects native code still references keep their wrappers but lose the toggle references, so
/// each is disposed when its native owners let it go, as in C, often inside the teardown of an
/// object released here; objects GTK keeps until the process ends are never disposed. Objects only
/// their wrappers reference are then released, which can leave more of them, until none is left.
/// Widgets go first, then instances of registered classes, then other objects, each in the order
/// they were first wrapped, so the views and JavaScript classes whose teardown calls back into
/// JavaScript still find the models, items and other objects their JavaScript state holds.
/// Surfaces and objects in a wrapper borrow keep their toggle references for the environment's own
/// teardown.
pub(crate) fn release_unowned() {
    let mut visited = HashSet::new();
    loop {
        release_queue::flush();
        detach_owned_objects();
        let round = next_unowned_objects(&visited);
        if round.is_empty() {
            break;
        }
        for (gobject, id) in round {
            visited.insert(id);
            if is_live_toggle(gobject, id) && unsafe { is_unowned(gobject, id) } {
                unsafe { release_unowned_object(gobject as *mut glib::gobject_ffi::GObject) };
            }
        }
    }
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
                    .try_with(|live| {
                        live.borrow().get(&(gobject as usize)) == Some(&notification_id)
                    })
                    .unwrap_or(false)
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
