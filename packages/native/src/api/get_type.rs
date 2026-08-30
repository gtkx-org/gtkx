use std::ffi::c_void;

use glib::gobject_ffi;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::type_from_bigint;
use crate::handle::Handle;

fn read_type_tag(ptr: *mut c_void) -> glib::ffi::GType {
    let instance = ptr.cast::<gobject_ffi::GTypeInstance>();
    let g_class = unsafe { (*instance).g_class };

    if g_class.is_null() {
        return 0;
    }

    unsafe { (*g_class).g_type }
}

fn gobject_type(handle: &Handle) -> glib::ffi::GType {
    let Some(gobject_ptr) = handle.as_gobject_ptr() else {
        return 0;
    };

    read_type_tag(gobject_ptr.cast::<c_void>())
}

fn is_instantiatable(type_: glib::ffi::GType) -> bool {
    unsafe { gobject_ffi::g_type_test_flags(type_, gobject_ffi::G_TYPE_FLAG_INSTANTIATABLE) != 0 }
}

fn is_a(type_: glib::ffi::GType, ancestor: glib::ffi::GType) -> bool {
    unsafe { gobject_ffi::g_type_is_a(type_, ancestor) != 0 }
}

/// Reads the type tag of a fundamental instance, which only the instantiatable fundamentals carry:
/// `GtkExpression` and `GskRenderNode` begin with a `GTypeInstance`, while `GVariant` does not, so
/// `declared_type` decides whether there is a tag to read at all. A tag that does not descend from
/// the declared type is discarded rather than trusted.
fn fundamental_type(handle: &Handle, declared: glib::ffi::GType) -> glib::ffi::GType {
    if !is_instantiatable(declared) {
        return 0;
    }

    let Some(ptr) = handle.as_fundamental_ptr() else {
        return 0;
    };

    let type_ = read_type_tag(ptr);

    if type_ == 0 || !is_a(type_, declared) {
        return 0;
    }

    type_
}

/// Returns the `GType` of the instance `handle` references, or 0 when it carries no type tag.
/// A `GObject` always carries one. A fundamental instance carries one only when the type the
/// binding declares, passed as `declaredType`, is instantiatable.
#[napi(catch_unwind)]
pub fn get_type(handle: &External<Handle>, declared_type: Option<BigInt>) -> Result<BigInt> {
    use glib::translate::IntoGlib as _;

    let declared = declared_type
        .map(|value| type_from_bigint(&value, "get_type: declared"))
        .transpose()?;

    let type_ = declared.map_or(0, |declared| fundamental_type(handle, declared.into_glib()));

    let resolved = if type_ == 0 {
        gobject_type(handle)
    } else {
        type_
    };

    Ok(BigInt::from(resolved as u64))
}
