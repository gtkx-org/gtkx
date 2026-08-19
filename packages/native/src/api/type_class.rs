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

#[cfg(test)]
mod tests {
    use glib::prelude::StaticType as _;

    use super::*;

    #[test]
    fn hands_back_the_class_struct_of_a_classed_type() {
        test_support::run(|| {
            let handle =
                class_pointer(glib::Object::static_type()).expect("GObject should be classed");
            let expected =
                unsafe { gobject_ffi::g_type_class_ref(glib::Object::static_type().into_glib()) };
            assert_eq!(handle.as_ptr(), expected.cast());
            unsafe { gobject_ffi::g_type_class_unref(expected) };
        });
    }

    #[test]
    fn rejects_a_type_that_carries_no_class() {
        test_support::run(|| {
            assert!(class_pointer(glib::Type::STRING).is_err());
        });
    }
}
