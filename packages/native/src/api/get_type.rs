use glib::gobject_ffi;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;

fn gobject_type(handle: &Handle) -> u64 {
    let Some(gobject_ptr) = handle.as_gobject_ptr() else {
        return 0;
    };

    let instance = gobject_ptr.cast::<gobject_ffi::GTypeInstance>();
    let g_class = unsafe { (*instance).g_class };

    if g_class.is_null() {
        return 0;
    }

    let type_ = unsafe { (*g_class).g_type };

    type_ as u64
}

/// Returns the `GType` of the `GObject` referenced by `handle`, or 0 when the handle does not
/// reference a `GObject`.
#[napi(catch_unwind)]
pub fn get_type(handle: &External<Handle>) -> Result<BigInt> {
    let type_ = gobject_type(handle);
    Ok(BigInt::from(type_))
}

#[cfg(test)]
mod tests {
    use glib::prelude::StaticType as _;
    use glib::translate::IntoGlib as _;

    use super::*;

    #[test]
    fn returns_zero_for_a_null_object_handle() {
        test_support::run(|| {
            assert_eq!(
                gobject_type(&Handle::from_glib_borrow(std::ptr::null_mut())),
                0
            );
        });
    }

    #[test]
    fn returns_zero_for_a_handle_that_is_not_a_gobject() {
        test_support::run(|| {
            let mut record: u64 = 0;
            let handle = Handle::from_glib_borrow((&raw mut record).cast());
            assert_eq!(gobject_type(&handle), 0);
        });
    }

    #[test]
    fn reads_gtype_from_instance() {
        test_support::run(|| {
            let (obj, _, _) = test_support::fresh_gobject();
            let handle = Handle::decoded_gobject(obj.clone());
            assert_eq!(
                gobject_type(&handle),
                glib::Object::static_type().into_glib() as u64
            );
            handle.release_owned();
            drop(obj);
        });
    }
}
