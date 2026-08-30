use glib::gobject_ffi;
use glib::translate::IntoGlib as _;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::type_from_bigint;
use crate::handle::Handle;

fn class_pointer(type_: glib::Type) -> Result<Handle> {
    let raw = type_.into_glib();
    let is_classed =
        unsafe { gobject_ffi::g_type_test_flags(raw, gobject_ffi::G_TYPE_FLAG_CLASSED) } != 0;

    if !is_classed {
        return Err(Error::new(
            Status::InvalidArg,
            format!("get_type_class: type '{}' is not classed", type_.name()),
        ));
    }

    let class_ptr = unsafe { gobject_ffi::g_type_class_ref(raw) };

    Ok(Handle::process_static(class_ptr.cast()))
}

/// Returns a handle over the class struct of `gtype`, taking a class reference that is
/// deliberately never released: the class struct of a statically registered type lives for the
/// rest of the process, so the handle borrows it without owning anything.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn get_type_class(gtype: BigInt) -> Result<External<Handle>> {
    let type_ = type_from_bigint(&gtype, "get_type_class")?;
    let handle = class_pointer(type_)?;
    let size_hint = handle.size_hint();

    Ok(External::new_with_size_hint(handle, size_hint))
}
