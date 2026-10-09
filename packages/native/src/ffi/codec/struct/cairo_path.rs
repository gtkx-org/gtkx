use std::ffi::{c_int, c_void};

use crate::ffi::library_cache::FfiCache;

type Destroy = unsafe extern "C" fn(*mut c_void);
type SurfaceCreate = unsafe extern "C" fn(c_int, c_int, c_int) -> *mut c_void;
type ContextCreate = unsafe extern "C" fn(*mut c_void) -> *mut c_void;
type AppendPath = unsafe extern "C" fn(*mut c_void, *const c_void);
type CopyPath = unsafe extern "C" fn(*mut c_void) -> *mut c_void;
type Status = unsafe extern "C" fn(*mut c_void) -> c_int;

struct CairoOwned {
    ptr: *mut c_void,
    destroy: Destroy,
}

impl Drop for CairoOwned {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            unsafe { (self.destroy)(self.ptr) };
        }
    }
}

pub(super) fn copy(library: &str, path: *mut c_void) -> anyhow::Result<*mut c_void> {
    let (
        surface_create,
        surface_destroy,
        context_create,
        context_destroy,
        append,
        copy,
        status,
        path_destroy,
    ) = FfiCache::with(|cache| unsafe {
        anyhow::Ok((
            cache.resolve_symbol::<SurfaceCreate>(library, "cairo_image_surface_create")?,
            cache.resolve_symbol::<Destroy>(library, "cairo_surface_destroy")?,
            cache.resolve_symbol::<ContextCreate>(library, "cairo_create")?,
            cache.resolve_symbol::<Destroy>(library, "cairo_destroy")?,
            cache.resolve_symbol::<AppendPath>(library, "cairo_append_path")?,
            cache.resolve_symbol::<CopyPath>(library, "cairo_copy_path")?,
            cache.resolve_symbol::<Status>(library, "cairo_status")?,
            cache.resolve_symbol::<Destroy>(library, "cairo_path_destroy")?,
        ))
    })?;
    let surface = CairoOwned {
        ptr: unsafe { surface_create(0, 1, 1) },
        destroy: surface_destroy,
    };
    anyhow::ensure!(
        !surface.ptr.is_null(),
        "Cairo could not allocate a copy surface"
    );
    let context = CairoOwned {
        ptr: unsafe { context_create(surface.ptr) },
        destroy: context_destroy,
    };
    anyhow::ensure!(
        !context.ptr.is_null(),
        "Cairo could not allocate a copy context"
    );
    unsafe { append(context.ptr, path) };
    let context_status = unsafe { status(context.ptr) };
    anyhow::ensure!(
        context_status == 0,
        "Cairo path copy failed with status {context_status}"
    );
    let mut result = CairoOwned {
        ptr: unsafe { copy(context.ptr) },
        destroy: path_destroy,
    };
    anyhow::ensure!(
        !result.ptr.is_null(),
        "Cairo could not allocate a path copy"
    );
    let result_status = unsafe { result.ptr.cast::<c_int>().read() };
    anyhow::ensure!(
        result_status == 0,
        "Cairo path copy failed with status {result_status}"
    );
    Ok(std::mem::replace(&mut result.ptr, std::ptr::null_mut()))
}
