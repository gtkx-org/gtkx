use glib::gobject_ffi;
use glib::translate::IntoGlib as _;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::vtable::query_type;
use crate::api::{native_result, type_from_bigint};
use crate::handle::Handle;

pub(crate) fn validate_class_type(type_: glib::Type, label: &str) -> anyhow::Result<()> {
    let is_classed = unsafe {
        gobject_ffi::g_type_test_flags(type_.into_glib(), gobject_ffi::G_TYPE_FLAG_CLASSED)
    } != 0;
    anyhow::ensure!(
        is_classed,
        "{label}: type '{}' is not classed",
        type_.name()
    );
    Ok(())
}

pub(crate) fn class_pointer(type_: glib::Type, label: &str) -> anyhow::Result<Handle> {
    validate_class_type(type_, label)?;
    let class_ptr = unsafe { gobject_ffi::g_type_class_ref(type_.into_glib()) };
    anyhow::ensure!(
        !class_ptr.is_null(),
        "{label}: type '{}' has no class structure",
        type_.name()
    );

    let owner = Handle::owned_struct_with_free_fn(class_ptr, Some(gobject_ffi::g_type_class_unref));
    let handle = Handle::pointer(class_ptr, &owner);
    Ok(match query_type(type_) {
        Some(query) => handle.with_allocated_bytes(query.class_size as usize),
        None => handle,
    })
}

/// Returns an owned reference to the class struct of `gtype`, bounded by the queried class size
/// when available. Dependent field and function handles retain the class reference.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn get_type_class(gtype: BigInt) -> Result<External<Handle>> {
    let type_ = type_from_bigint(&gtype, "get_type_class")?;
    let handle = native_result("get_type_class", class_pointer(type_, "get_type_class"))?;
    let size_hint = handle.size_hint();

    Ok(External::new_with_size_hint(handle, size_hint))
}
