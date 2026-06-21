use glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::managed::NativeHandle;

#[cfg_attr(test, allow(dead_code))]
struct GetTypeRequest {
    instance_addr: usize,
}

impl ModuleRequest for GetTypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        if self.instance_addr == 0 {
            return Ok(0);
        }
        let instance = self.instance_addr as *mut gobject_ffi::GTypeInstance;
        // SAFETY: `instance_addr` is non-zero (checked above) and points to a live
        // `GTypeInstance`; reading its `g_class` field is sound (the field may itself be null,
        // which is handled below).
        let g_class = unsafe { (*instance).g_class };
        if g_class.is_null() {
            return Ok(0);
        }
        // SAFETY: `g_class` is non-null (checked above) and points to the instance's live
        // `GTypeClass`; reading its `g_type` field yields the registered GType.
        let gtype = unsafe { (*g_class).g_type };
        Ok(gtype as u64)
    }

    fn error_context() -> &'static str {
        "get_type"
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn get_type<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
    ) -> napi::Result<Unknown<'env>> {
        GetTypeRequest {
            instance_addr: handle.ptr_as_usize(),
        }
        .dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use glib::translate::{IntoGlib as _, ToGlibPtr as _};
    use gtk4::prelude::StaticType as _;

    use super::*;

    fn object_addr(object: &glib::Object) -> usize {
        let ptr: *const glib::gobject_ffi::GObject = object.to_glib_none().0;
        ptr as usize
    }

    #[test]
    fn get_type_returns_real_gtype() {
        let object = glib::Object::new::<glib::Object>();
        let request = GetTypeRequest {
            instance_addr: object_addr(&object),
        };
        let gtype = request.execute().expect("gtype query should succeed");
        assert_eq!(gtype, glib::Object::static_type().into_glib() as u64);
    }

    #[test]
    fn get_type_returns_zero_for_null_instance() {
        let request = GetTypeRequest { instance_addr: 0 };
        let gtype = request.execute().expect("null instance should be Ok(0)");
        assert_eq!(gtype, 0);
    }

    #[test]
    fn get_type_returns_zero_for_instance_without_class() {
        // SAFETY: `GTypeInstance` is a single nullable `g_class` pointer field, for which an
        // all-zero bit pattern is a valid value representing an instance with a null class.
        let mut instance: gobject_ffi::GTypeInstance = unsafe { std::mem::zeroed() };
        let request = GetTypeRequest {
            instance_addr: std::ptr::addr_of_mut!(instance) as usize,
        };
        let gtype = request
            .execute()
            .expect("instance without class should be Ok(0)");
        assert_eq!(gtype, 0);
    }

    #[test]
    fn get_type_error_context_is_stable() {
        assert_eq!(GetTypeRequest::error_context(), "get_type");
    }
}
