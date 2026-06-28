use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct VoidDescriptor;

impl FfiEncoder for VoidDescriptor {
    fn encode(&self, _value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::void()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::StashedValue> {
        unsafe { cif.call::<()>(ptr, args) };
        Ok(ffi::StashedValue::Void)
    }
}

impl FfiDecoder for VoidDescriptor {
    unsafe fn read(&self, _src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }
}

impl PointerWriter for VoidDescriptor {
    unsafe fn write_return_to_pointer(&self, _ret: *mut c_void, _value: &Result<value::Value, ()>) {
    }
}
