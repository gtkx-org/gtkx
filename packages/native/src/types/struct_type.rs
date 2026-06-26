use anyhow::bail;
use napi::{Env, JsObject};

use super::prelude::*;
use crate::managed::Boxed;

#[derive(Debug, Clone)]
pub struct StructType {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
}

impl StructType {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_descriptor(obj, "struct")?;

        let size: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "size")?.map(|n| n as usize);

        let caller_allocated: bool =
            super::optional_descriptor_property(obj, "callerAllocated")?.unwrap_or(false);

        Ok(Self {
            ownership,
            size,
            caller_allocated,
        })
    }
}

impl FfiEncoder for StructType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Struct object")?;
        Ok(ffi::FfiValue::Ptr(ptr))
    }
}

impl FfiDecoder for StructType {
    fn read_call(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(struct_ptr) = ffi_value.as_non_null_ptr("Struct")? else {
            return Ok(value::Value::Null);
        };

        let boxed = match self.ownership {
            Ownership::Full => Boxed::from_glib_full(None, struct_ptr),
            Ownership::Borrowed => self.size.map_or_else(
                || Boxed::from_glib_borrow(struct_ptr),
                |size| Boxed::copy_with_size(struct_ptr, size),
            ),
        };

        Ok(boxed.into())
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
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

impl RawPtrWriter for StructType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, std::convert::identity);
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value.object_ptr("Struct field write")?;
            if src_ptr.is_null() {
                // SAFETY: `ptr` is a pointer-sized writable field slot per the contract; a null
                // source clears the slot.
                unsafe { (ptr as *mut *mut c_void).write_unaligned(std::ptr::null_mut()) };
                return Ok(());
            }
            // SAFETY: `ptr` is a pointer-sized readable field slot per the contract; this loads the
            // destination struct pointer it currently holds.
            let dst_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
            if dst_ptr.is_null() {
                bail!("Struct field write into null pointer slot")
            }
            // SAFETY: `src_ptr` is the non-null source struct and `dst_ptr` the non-null
            // destination, both at least `size` bytes (the descriptor's struct size) and
            // non-overlapping field storage; this copies the struct body by value into the slot.
            unsafe {
                std::ptr::copy_nonoverlapping(src_ptr as *const u8, dst_ptr as *mut u8, size);
            }
            return Ok(());
        }
        write_object_ptr(ptr, value, "Struct field write")
    }
}
