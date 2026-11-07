use std::cell::RefCell;

use glib::prelude::*;
use glib::translate::{Borrowed, from_glib_borrow};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::handle::Handle;
use crate::host::panic_handler::guard_ffi_boundary;

#[derive(Default)]
struct Dependents(RefCell<Vec<glib::WeakRef<glib::Object>>>);

struct Deferred(RefCell<Vec<glib::Object>>);

fn dependents_key() -> glib::Quark {
    glib::Quark::from_static_str(glib::gstr!("gtkx-deferred-finalization-dependents"))
}

fn deferred_key() -> glib::Quark {
    glib::Quark::from_static_str(glib::gstr!("gtkx-deferred-finalization"))
}

fn retain_until_finalized(dependent: &glib::Object, object: glib::Object) {
    let key = deferred_key();

    match unsafe { dependent.qdata::<Deferred>(key) } {
        Some(deferred) => unsafe { deferred.as_ref() }.0.borrow_mut().push(object),
        None => unsafe { dependent.set_qdata(key, Deferred(RefCell::new(vec![object]))) },
    }
}

unsafe extern "C" fn on_dispose(
    _data: glib::ffi::gpointer,
    object: *mut glib::gobject_ffi::GObject,
) {
    guard_ffi_boundary("deferred finalization", || {
        let object: Borrowed<glib::Object> = unsafe { from_glib_borrow(object) };
        let Some(dependents) = (unsafe { object.steal_qdata::<Dependents>(dependents_key()) })
        else {
            return;
        };

        if object.ref_count() == 0 {
            return;
        }

        for dependent in dependents
            .0
            .into_inner()
            .iter()
            .filter_map(glib::WeakRef::upgrade)
        {
            retain_until_finalized(&dependent, (*object).clone());
        }
    });
}

fn live_object(handle: &Handle) -> Result<Borrowed<glib::Object>> {
    let Some(gobject) = handle.as_gobject_ptr() else {
        return Err(Error::new(
            Status::InvalidArg,
            "deferFinalization: the handle does not reference a live GObject",
        ));
    };

    Ok(unsafe { from_glib_borrow(gobject) })
}

fn dependents(object: &glib::Object) -> &Dependents {
    let key = dependents_key();

    if let Some(dependents) = unsafe { object.qdata::<Dependents>(key) } {
        return unsafe { dependents.as_ref() };
    }

    unsafe {
        object.set_qdata(key, Dependents::default());
        glib::gobject_ffi::g_object_weak_ref(
            object.as_ptr(),
            Some(on_dispose),
            std::ptr::null_mut(),
        );
        object
            .qdata::<Dependents>(key)
            .expect("the dependents were just attached")
            .as_ref()
    }
}

/// Keeps `object`'s instance allocated after it is disposed until `dependent` is finalized, for
/// upstream code that writes into `object` while `dependent` finalizes. Disposal itself is not
/// delayed, so a dependent inside `object`'s widget tree forms no reference cycle. Nothing is kept
/// when `dependent` is already gone by the time `object` is disposed, and repeating a pair has no
/// further effect.
#[napi(catch_unwind)]
pub fn defer_finalization(object: &External<Handle>, dependent: &External<Handle>) -> Result<()> {
    let _object_lease = native_result("deferFinalization", object.acquire_lease())?;
    let _dependent_lease = native_result("deferFinalization", dependent.acquire_lease())?;
    let object = live_object(object)?;
    let dependent = live_object(dependent)?;
    let mut registered = dependents(&object).0.borrow_mut();

    registered.retain(|weak| weak.upgrade().is_some());

    if !registered.iter().any(|weak| {
        weak.upgrade()
            .is_some_and(|existing| existing == *dependent)
    }) {
        registered.push(dependent.downgrade());
    }

    Ok(())
}
