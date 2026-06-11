use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct VoidType;

impl FfiEncoder for VoidType {
    fn encode(&self, _value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
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
        // SAFETY: The dispatch site built `cif` and `args` for this
        // descriptor and resolved `ptr` from a loaded library symbol.
        unsafe { cif.call::<()>(ptr, args) };
        Ok(ffi::FfiValue::Void)
    }
}

impl FfiDecoder for VoidType {
    fn decode(&self, _ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }
}

impl RawPtrCodec for VoidType {
    unsafe fn ptr_to_value(
        &self,
        _ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }

    unsafe fn read_from_raw_ptr(
        &self,
        _ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }

    unsafe fn write_return_to_raw_ptr(&self, _ret: *mut c_void, _value: &Result<value::Value, ()>) {
    }
}
