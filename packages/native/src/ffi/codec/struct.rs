use anyhow::bail;

use super::prelude::*;
use crate::handle::Boxed;

#[derive(Debug, Clone)]
pub struct StructCodec {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
}

impl Encoder for StructCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let ptr = value.object_ptr("Struct object")?;
        Ok(ffi::StashedValue::Ptr(ptr))
    }
}

impl Decoder for StructCodec {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        self.read_call_non_null(stashed_value, "Struct", |struct_ptr| {
            let boxed = match self.ownership {
                Ownership::Full => Boxed::from_glib_full(None, struct_ptr),
                Ownership::Borrowed => self.size.map_or_else(
                    || Boxed::from_glib_borrow(struct_ptr),
                    |size| Boxed::copy_with_size(struct_ptr, size),
                ),
            };

            Ok(boxed.into())
        })
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.decode_non_null(ptr, |ptr| {
            if self.caller_allocated {
                return Ok(Boxed::from_glib_borrow(ptr).into());
            }
            let boxed = self.size.map_or_else(
                || Boxed::from_glib_borrow(ptr),
                |size| Boxed::copy_with_size(ptr, size),
            );
            Ok(boxed.into())
        })
    }
}

impl PtrWriter for StructCodec {
    unsafe fn write_return_to_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, std::convert::identity);
    }

    unsafe fn write_value_to_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value.object_ptr("Struct field write")?;
            if src_ptr.is_null() {
                unsafe { ffi::Slot::new(ptr).store(std::ptr::null_mut()) };
                return Ok(());
            }
            let dst_ptr = unsafe { ffi::Slot::new(ptr).load() };
            if dst_ptr.is_null() {
                bail!("Struct field write into null pointer slot")
            }
            unsafe {
                std::ptr::copy_nonoverlapping(src_ptr as *const u8, dst_ptr as *mut u8, size);
            }
            return Ok(());
        }
        write_object_ptr(ptr, value, "Struct field write")
    }
}
