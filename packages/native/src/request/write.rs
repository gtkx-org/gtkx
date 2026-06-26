use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::NativeRequest;
use super::read::FieldLocation;
use crate::ffi::descriptors::{Descriptor, PointerWriter as _};
use crate::ffi::value::Value;
use crate::handle::NativeHandle;

#[cfg_attr(test, allow(dead_code))]
struct WriteRequest {
    location: FieldLocation,
    field_type: Descriptor,
    value: Value,
}

impl NativeRequest for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        // SAFETY: runs on the gtkx-glib thread; `location` was built from a live `NativeHandle`
        // pointer plus an in-bounds field offset, satisfying `resolve`'s contract.
        let field_ptr = unsafe { self.location.resolve()? };
        // SAFETY: `field_ptr` addresses a valid, writable field slot of `field_type`; the codec
        // writes `value` into it, balancing any owned pointer the slot previously held.
        unsafe {
            self.field_type
                .write_value_to_pointer(field_ptr, &self.value)
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
    pub fn write<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
        js_type: Unknown<'_>,
        offset: f64,
        value: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = Descriptor::from_descriptor(env, js_type)?;
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
    use crate::ffi::descriptors::IntegerKind;
    use crate::request::read::ReadRequest;

    use super::*;

    #[test]
    fn write_then_read_round_trips_an_integer() {
        let mut buffer = [0u8; 32];
        let base_addr = buffer.as_mut_ptr() as usize;

        let write = WriteRequest {
            location: FieldLocation {
                base_addr,
                offset: 8,
            },
            field_type: Descriptor::Integer(IntegerKind::I32),
            value: Value::Number(1234.0),
        };
        write.execute().expect("write should succeed");

        let read = ReadRequest {
            location: FieldLocation {
                base_addr,
                offset: 8,
            },
            field_type: Descriptor::Integer(IntegerKind::I32),
        };
        let value = read.execute().expect("read should succeed");
        let n = value.as_number().expect("read result should be a number");
        assert!((n - 1234.0).abs() < f64::EPSILON);
    }

    #[test]
    fn write_rejects_null_base() {
        let write = WriteRequest {
            location: FieldLocation {
                base_addr: 0,
                offset: 0,
            },
            field_type: Descriptor::Integer(IntegerKind::I32),
            value: Value::Number(0.0),
        };
        let err = write.execute().expect_err("null base write should fail");
        assert!(err.to_string().contains("null pointer"));
    }

    #[test]
    fn write_error_context_is_stable() {
        assert_eq!(WriteRequest::error_context(), "field write");
    }
}
