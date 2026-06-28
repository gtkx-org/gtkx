use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::descriptor::{Codec, Descriptor, FfiDecoder as _, ReadSource};
use crate::ffi::value::Value;
use crate::handle::Handle;

pub struct FieldLocation {
    pub base_addr: usize,
    pub offset: usize,
}

impl FieldLocation {
    pub unsafe fn resolve(&self) -> anyhow::Result<*mut c_void> {
        if self.base_addr == 0 {
            anyhow::bail!("Handle has a null pointer");
        }
        Ok(unsafe { (self.base_addr as *mut u8).add(self.offset) as *mut c_void })
    }
}

pub struct ReadRequest {
    pub location: FieldLocation,
    pub field_type: Codec,
}

impl Request for ReadRequest {
    type Output = Value;

    fn execute(self) -> anyhow::Result<Value> {
        let field_ptr = unsafe { self.location.resolve()? }.cast_const();
        unsafe {
            self.field_type
                .read(ReadSource::Slot(field_ptr, "field read"))
        }
    }

    fn error_context() -> &'static str {
        "field read"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn read<'env>(
        env: &'env Env,
        handle: &External<Handle>,
        js_type: Descriptor,
        offset: f64,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = js_type.into_codec()?;
        let request = ReadRequest {
            location: FieldLocation {
                base_addr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_type,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use crate::ffi::descriptor::IntegerKind;

    use super::*;

    #[test]
    fn resolve_returns_offset_address() {
        let mut buffer = [0u8; 32];
        let base_addr = buffer.as_mut_ptr() as usize;
        let location = FieldLocation {
            base_addr,
            offset: 8,
        };
        let resolved = unsafe { location.resolve() }.expect("resolve should succeed");
        assert_eq!(resolved as usize, base_addr + 8);
    }

    #[test]
    fn resolve_rejects_null_base() {
        let location = FieldLocation {
            base_addr: 0,
            offset: 0,
        };
        let err = unsafe { location.resolve() }.expect_err("null base should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn read_rejects_null_base() {
        let read = ReadRequest {
            location: FieldLocation {
                base_addr: 0,
                offset: 0,
            },
            field_type: Codec::Integer(IntegerKind::I32),
        };
        let err = read.execute().expect_err("null base read should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn read_error_context_is_stable() {
        assert_eq!(ReadRequest::error_context(), "field read");
    }
}
