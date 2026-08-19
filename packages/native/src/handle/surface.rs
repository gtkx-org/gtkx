use std::cell::Cell;
use std::ffi::c_void;

use glib::prelude::{ObjectExt as _, ObjectType as _};

use crate::ffi::library_cache::FfiCache;

type IsDestroyedFn = unsafe extern "C" fn(*mut c_void) -> glib::ffi::gboolean;
type DestroyFn = unsafe extern "C" fn(*mut c_void);

const GTK_LIBRARY: &str = "libgtk-4.so.1";

thread_local! {
    static SURFACE_TYPE: Cell<Option<glib::Type>> = const { Cell::new(None) };
    static SURFACE_FNS: Cell<Option<(IsDestroyedFn, DestroyFn)>> = const { Cell::new(None) };
}

fn surface_type() -> Option<glib::Type> {
    if let Some(cached) = SURFACE_TYPE.with(Cell::get) {
        return Some(cached);
    }

    let found = glib::Type::from_name("GdkSurface")?;
    SURFACE_TYPE.with(|slot| slot.set(Some(found)));
    Some(found)
}

fn surface_fns() -> Option<(IsDestroyedFn, DestroyFn)> {
    if let Some(cached) = SURFACE_FNS.with(Cell::get) {
        return Some(cached);
    }

    let resolved = FfiCache::with(|cache| {
        let is_destroyed = unsafe {
            cache.resolve_symbol::<IsDestroyedFn>(GTK_LIBRARY, "gdk_surface_is_destroyed")
        }
        .ok()?;
        let destroy =
            unsafe { cache.resolve_symbol::<DestroyFn>(GTK_LIBRARY, "gdk_surface_destroy") }
                .ok()?;
        Some((is_destroyed, destroy))
    })?;

    SURFACE_FNS.with(|slot| slot.set(Some(resolved)));
    Some(resolved)
}

pub(crate) fn awaits_destroy(object: &glib::Object) -> bool {
    if object.ref_count() != 1 {
        return false;
    }

    let Some(surface_type) = surface_type() else {
        return false;
    };

    if !object.type_().is_a(surface_type) {
        return false;
    }

    let Some((is_destroyed, _)) = surface_fns() else {
        return false;
    };

    unsafe { is_destroyed(object.as_ptr().cast()) == glib::ffi::GFALSE }
}

pub(crate) fn release(object: glib::Object) {
    if !awaits_destroy(&object) {
        drop(object);
        return;
    }

    let Some((_, destroy)) = surface_fns() else {
        drop(object);
        return;
    };

    let ptr = object.as_ptr().cast::<c_void>();
    std::mem::forget(object);
    unsafe { destroy(ptr) };
}
