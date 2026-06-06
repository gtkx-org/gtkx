//! `GObject` runtime helpers.
//!
//! Provides direct access to `GObject` class metadata so that JavaScript does
//! not need to traverse the `GTypeInstance` → `GTypeClass` → `GObjectClass`
//! chain through several individual FFI dispatches.

use gtk4::glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::managed::NativeHandle;

#[cfg_attr(test, allow(dead_code))]
struct GetInstanceGtypeRequest {
    instance_addr: usize,
}

impl ModuleRequest for GetInstanceGtypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        if self.instance_addr == 0 {
            return Ok(0);
        }
        let instance = self.instance_addr as *mut gobject_ffi::GTypeInstance;
        let g_class = unsafe { (*instance).g_class };
        if g_class.is_null() {
            return Ok(0);
        }
        let gtype = unsafe { (*g_class).g_type };
        Ok(gtype as u64)
    }

    fn error_context() -> &'static str {
        "get_instance_gtype"
    }
}

/// napi export shim for `GObject` metadata access. Excluded from coverage
/// instrumentation: it dispatches through a live [`napi::Env`]. The
/// [`GetInstanceGtypeRequest`] `execute` logic it dispatches is exercised
/// directly by tests.
#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn get_instance_gtype<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
    ) -> napi::Result<Unknown<'env>> {
        GetInstanceGtypeRequest {
            instance_addr: handle.ptr_as_usize(),
        }
        .dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use gtk4::glib;
    use gtk4::glib::translate::{IntoGlib as _, ToGlibPtr as _};
    use gtk4::prelude::StaticType as _;

    use super::*;

    fn object_addr(object: &glib::Object) -> usize {
        let ptr: *const glib::gobject_ffi::GObject = object.to_glib_none().0;
        ptr as usize
    }

    #[test]
    fn get_instance_gtype_returns_real_gtype() {
        let object = glib::Object::new::<glib::Object>();
        let request = GetInstanceGtypeRequest {
            instance_addr: object_addr(&object),
        };
        let gtype = request.execute().expect("gtype query should succeed");
        assert_eq!(gtype, glib::Object::static_type().into_glib() as u64);
    }

    #[test]
    fn get_instance_gtype_returns_zero_for_null_instance() {
        let request = GetInstanceGtypeRequest { instance_addr: 0 };
        let gtype = request.execute().expect("null instance should be Ok(0)");
        assert_eq!(gtype, 0);
    }

    #[test]
    fn get_instance_gtype_returns_zero_for_instance_without_class() {
        let mut instance: gobject_ffi::GTypeInstance = unsafe { std::mem::zeroed() };
        let request = GetInstanceGtypeRequest {
            instance_addr: std::ptr::addr_of_mut!(instance) as usize,
        };
        let gtype = request
            .execute()
            .expect("instance without class should be Ok(0)");
        assert_eq!(gtype, 0);
    }

    #[test]
    fn get_instance_gtype_error_context_is_stable() {
        assert_eq!(
            GetInstanceGtypeRequest::error_context(),
            "get_instance_gtype"
        );
    }
}
