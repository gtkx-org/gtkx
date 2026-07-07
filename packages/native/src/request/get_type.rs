use glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::Handle;

struct GetTypeRequest {
    gobject_ptr: usize,
}

impl Request for GetTypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        if self.gobject_ptr == 0 {
            return Ok(0);
        }
        let instance = self.gobject_ptr as *mut gobject_ffi::GTypeInstance;
        let g_class = unsafe { (*instance).g_class };
        let type_ = unsafe { (*g_class).g_type };
        Ok(type_ as u64)
    }

    fn error_context() -> &'static str {
        "get_type"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn get_type(env: Env, handle: &External<Handle>) -> napi::Result<BigInt> {
        let type_ = GetTypeRequest {
            gobject_ptr: handle.ptr_as_usize(),
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(type_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::request::Request;
    use glib::prelude::StaticType as _;
    use glib::translate::IntoGlib as _;

    #[test]
    fn execute_returns_zero_for_null_pointer() {
        test_support::run(|| {
            let request = GetTypeRequest { gobject_ptr: 0 };
            assert_eq!(request.execute().expect("get_type should succeed"), 0);
        });
    }

    #[test]
    fn execute_reads_gtype_from_instance() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let request = GetTypeRequest {
                gobject_ptr: obj_ptr as usize,
            };
            let type_ = request.execute().expect("get_type should succeed");
            assert_eq!(type_, glib::Object::static_type().into_glib() as u64);
            drop(obj);
        });
    }
}
