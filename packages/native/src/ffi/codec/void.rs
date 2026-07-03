use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct VoidCodec;

impl Encoder for VoidCodec {
    fn encode(&self, _value: &value::Value) -> anyhow::Result<ffi::Stash> {
        Ok(ffi::Stash::Ptr(std::ptr::null_mut()))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::void()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::Stash> {
        unsafe { cif.call::<()>(ptr, args) };
        Ok(ffi::Stash::Void)
    }
}

impl Decoder for VoidCodec {
    unsafe fn read(&self, _src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }
}

impl PtrWriter for VoidCodec {
    fn write_return_to_ptr(&self, _ret: ffi::Slot, _value: &Result<value::Value, ()>) {}
}
