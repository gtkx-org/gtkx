use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::NativeRequest;
use crate::ffi::descriptors::{Descriptor, FfiDecoder as _, ReadSource};
use crate::ffi::value::Value;
use crate::handle::NativeHandle;

#[cfg_attr(test, allow(dead_code))]
pub struct FieldLocation {
    pub base_addr: usize,
    pub offset: usize,
}

impl FieldLocation {
    /// Resolves the field address as `base_addr + offset`.
    ///
    /// # Safety
    ///
    /// `base_addr` must be 0 or the address of a live struct, and `base_addr + offset` must stay
    /// within that struct's allocation so the returned pointer addresses a valid field slot.
    #[cfg_attr(test, allow(dead_code))]
    pub unsafe fn resolve(&self) -> anyhow::Result<*mut c_void> {
        if self.base_addr == 0 {
            anyhow::bail!("NativeHandle has a null pointer");
        }
        // SAFETY: `base_addr` is non-null (checked above) and, per the contract, `offset` lies
        // within the struct's allocation, so the `add` stays in bounds of the same object.
        Ok(unsafe { (self.base_addr as *mut u8).add(self.offset) as *mut c_void })
    }
}

#[cfg_attr(test, allow(dead_code))]
pub struct ReadRequest {
    pub location: FieldLocation,
    pub field_type: Descriptor,
}

impl NativeRequest for ReadRequest {
    type Output = Value;

    fn execute(self) -> anyhow::Result<Value> {
        // SAFETY: runs on the gtkx-glib thread; `location` was built from a live `NativeHandle`
        // pointer plus an in-bounds field offset, satisfying `resolve`'s contract.
        let field_ptr = unsafe { self.location.resolve()? }.cast_const();
        // SAFETY: `field_ptr` addresses a valid field slot of `field_type`; reading from it as a
        // `Slot` source decodes the field according to that type.
        unsafe {
            self.field_type
                .read(ReadSource::Slot(field_ptr, "field read"))
        }
    }

    fn error_context() -> &'static str {
        "field read"
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn read<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
        js_type: Unknown<'_>,
        offset: f64,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = Descriptor::from_descriptor(env, js_type)?;
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
    use crate::ffi::descriptors::IntegerKind;

    use super::*;

    #[test]
    fn resolve_returns_offset_address() {
        let mut buffer = [0u8; 32];
        let base_addr = buffer.as_mut_ptr() as usize;
        let location = FieldLocation {
            base_addr,
            offset: 8,
        };
        // SAFETY: `base_addr` is the address of the live 32-byte `buffer` and offset 8 is within it.
        let resolved = unsafe { location.resolve() }.expect("resolve should succeed");
        assert_eq!(resolved as usize, base_addr + 8);
    }

    #[test]
    fn resolve_rejects_null_base() {
        let location = FieldLocation {
            base_addr: 0,
            offset: 0,
        };
        // SAFETY: a zero `base_addr` is the explicit null case `resolve` rejects without deref.
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
            field_type: Descriptor::Integer(IntegerKind::I32),
        };
        let err = read.execute().expect_err("null base read should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn read_error_context_is_stable() {
        assert_eq!(ReadRequest::error_context(), "field read");
    }
}
