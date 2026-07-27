use std::ffi::c_void;

use glib::gobject_ffi;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;

fn gobject_type(gobject_ptr: *mut c_void) -> u64 {
    if gobject_ptr.is_null() {
        return 0;
    }

    let instance = gobject_ptr.cast::<gobject_ffi::GTypeInstance>();
    let g_class = unsafe { (*instance).g_class };

    if g_class.is_null() {
        return 0;
    }

    let type_ = unsafe { (*g_class).g_type };

    type_ as u64
}

/// Returns the `GType` of the `GObject` referenced by `handle`, or 0 when the pointer is null.
#[napi(catch_unwind)]
pub fn get_type(handle: &External<Handle>) -> Result<BigInt> {
    let type_ = gobject_type(handle.as_ptr());
    Ok(BigInt::from(type_))
}

#[cfg(test)]
mod tests {
    use super::*;
    use glib::prelude::StaticType as _;
    use glib::translate::IntoGlib as _;

    #[test]
    fn returns_zero_for_null_pointer() {
        test_support::run(|| {
            assert_eq!(gobject_type(std::ptr::null_mut()), 0);
        });
    }

    #[test]
    fn reads_gtype_from_instance() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let type_ = gobject_type(obj_ptr.cast());
            assert_eq!(type_, glib::Object::static_type().into_glib() as u64);
            drop(obj);
        });
    }
}
