use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct VoidType;

impl FfiEncoder for VoidType {
    fn encode(&self, _value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::void()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        // SAFETY: `cif` was built to describe the callee at `ptr` with argument types matching
        // `args`, and a void return is requested as `()`; invoking it on the gtkx-glib thread
        // performs the C call under that agreed signature.
        unsafe { cif.call::<()>(ptr, args) };
        Ok(ffi::FfiValue::Void)
    }
}

impl FfiDecoder for VoidType {
    unsafe fn read(&self, _src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }
}

impl RawPtrCodec for VoidType {
    unsafe fn write_return_to_raw_ptr(&self, _ret: *mut c_void, _value: &Result<value::Value, ()>) {
    }
}
