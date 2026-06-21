use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::managed::NativeHandle;
use crate::types::{FfiDecoder as _, RawPtrCodec as _, ReadSource, Type};
use crate::value::Value;

#[cfg_attr(test, allow(dead_code))]
struct FieldLocation {
    base_addr: usize,
    offset: usize,
}

impl FieldLocation {
    /// Resolves the field address as `base_addr + offset`.
    ///
    /// # Safety
    ///
    /// `base_addr` must be 0 or the address of a live struct, and `base_addr + offset` must stay
    /// within that struct's allocation so the returned pointer addresses a valid field slot.
    #[cfg_attr(test, allow(dead_code))]
    unsafe fn resolve(&self) -> anyhow::Result<*mut c_void> {
        if self.base_addr == 0 {
            anyhow::bail!("NativeHandle has a null pointer");
        }
        // SAFETY: `base_addr` is non-null (checked above) and, per the contract, `offset` lies
        // within the struct's allocation, so the `add` stays in bounds of the same object.
        Ok(unsafe { (self.base_addr as *mut u8).add(self.offset) as *mut c_void })
    }
}

#[cfg_attr(test, allow(dead_code))]
struct ReadRequest {
    location: FieldLocation,
    field_type: Type,
}

impl ModuleRequest for ReadRequest {
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

#[cfg_attr(test, allow(dead_code))]
struct WriteRequest {
    location: FieldLocation,
    field_type: Type,
    value: Value,
}

impl ModuleRequest for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        // SAFETY: runs on the gtkx-glib thread; `location` was built from a live `NativeHandle`
        // pointer plus an in-bounds field offset, satisfying `resolve`'s contract.
        let field_ptr = unsafe { self.location.resolve()? };
        // SAFETY: `field_ptr` addresses a valid, writable field slot of `field_type`; the codec
        // writes `value` into it, balancing any owned pointer the slot previously held.
        unsafe {
            self.field_type
                .write_value_to_raw_ptr(field_ptr, &self.value)
        }
    }

    fn error_context() -> &'static str {
        "field write"
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
        let field_type = Type::from_js_value(env, js_type)?;
        let request = ReadRequest {
            location: FieldLocation {
                base_addr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_type,
        };
        request.dispatch(env)
    }

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn write<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
        js_type: Unknown<'_>,
        offset: f64,
        value: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = Type::from_js_value(env, js_type)?;
        let parsed_value = Value::from_js_value(env, value)?;
        let request = WriteRequest {
            location: FieldLocation {
                base_addr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_type,
            value: parsed_value,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use crate::types::IntegerKind;

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
    fn write_then_read_round_trips_an_integer() {
        let mut buffer = [0u8; 32];
        let base_addr = buffer.as_mut_ptr() as usize;

        let write = WriteRequest {
            location: FieldLocation {
                base_addr,
                offset: 8,
            },
            field_type: Type::Integer(IntegerKind::I32),
            value: Value::Number(1234.0),
        };
        write.execute().expect("write should succeed");

        let read = ReadRequest {
            location: FieldLocation {
                base_addr,
                offset: 8,
            },
            field_type: Type::Integer(IntegerKind::I32),
        };
        let value = read.execute().expect("read should succeed");
        let n = value.as_number().expect("read result should be a number");
        assert!((n - 1234.0).abs() < f64::EPSILON);
    }

    #[test]
    fn read_rejects_null_base() {
        let read = ReadRequest {
            location: FieldLocation {
                base_addr: 0,
                offset: 0,
            },
            field_type: Type::Integer(IntegerKind::I32),
        };
        let err = read.execute().expect_err("null base read should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn write_rejects_null_base() {
        let write = WriteRequest {
            location: FieldLocation {
                base_addr: 0,
                offset: 0,
            },
            field_type: Type::Integer(IntegerKind::I32),
            value: Value::Number(0.0),
        };
        let err = write.execute().expect_err("null base write should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn error_contexts_are_stable() {
        assert_eq!(ReadRequest::error_context(), "field read");
        assert_eq!(WriteRequest::error_context(), "field write");
    }
}
