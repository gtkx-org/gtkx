use glib::ffi::g_malloc0;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::{Boxed, Handle};
use crate::request::native_result;

fn alloc_handle(size: usize, type_name: Option<String>) -> anyhow::Result<Handle> {
    let type_name = type_name
        .map(glib::GString::from_string_checked)
        .transpose()
        .map_err(|err| anyhow::anyhow!("invalid alloc type name: {err}"))?;

    let ptr = unsafe { g_malloc0(size) };
    let boxed = Boxed::from_alloc(type_name, ptr);
    Ok(Handle::Boxed(boxed))
}

/// Allocates a zero-filled native memory block of `size` bytes and returns an opaque handle to it.
/// The optional `typeName` tags the boxed allocation with a GType name.
#[napi(catch_unwind)]
pub fn alloc(size: f64, type_name: Option<String>) -> napi::Result<External<Handle>> {
    let handle = native_result("alloc", alloc_handle(size as usize, type_name))?;
    let size_hint = handle.size_hint();
    Ok(External::new_with_size_hint(handle, size_hint))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allocates_untyped_boxed_handle() {
        test_support::run(|| {
            let handle = alloc_handle(32, None).expect("alloc should succeed");
            assert!(!handle.as_ptr().is_null());
        });
    }

    #[test]
    fn rejects_type_name_with_interior_nul() {
        test_support::run(|| {
            assert!(alloc_handle(16, Some("bad\0type".to_owned())).is_err());
        });
    }
}
