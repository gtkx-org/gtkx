use anyhow::bail;

use super::prelude::*;
use crate::handle::{Boxed, Handle};

#[derive(Debug, Clone)]
pub struct StructCodec {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
}

impl Encoder for StructCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Struct object"
    }
}

impl StructCodec {
    fn borrow_or_copy(&self, ptr: *mut c_void) -> Boxed {
        self.size.map_or_else(
            || Boxed::from_glib_borrow(ptr),
            |size| Boxed::copy_with_size(ptr, size),
        )
    }
}

impl Decoder for StructCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Struct", |struct_ptr| {
            let boxed = match self.ownership {
                Ownership::Full => Boxed::from_glib_full(None, struct_ptr),
                Ownership::Borrowed => self.borrow_or_copy(struct_ptr),
            };

            Ok(value::handle_to_unknown(env, Handle::from(boxed))?)
        })
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| {
            let boxed = if self.caller_allocated {
                Boxed::from_glib_borrow(ptr)
            } else {
                self.borrow_or_copy(ptr)
            };

            Ok(value::handle_to_unknown(env, Handle::from(boxed))?)
        })
    }
}

impl PtrWriter for StructCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        write_return_object_ptr(env, ret, value, std::convert::identity);
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value::handle_ptr(env, value, "Struct field write")?;
            if src_ptr.is_null() {
                unsafe { slot.store(std::ptr::null_mut()) };
                return Ok(());
            }
            let dest_ptr = unsafe { slot.load() };
            if dest_ptr.is_null() {
                bail!("Struct field write into null pointer slot")
            }
            unsafe {
                std::ptr::copy_nonoverlapping(src_ptr as *const u8, dest_ptr as *mut u8, size);
            }
            return Ok(());
        }
        write_object_ptr(env, slot, value, "Struct field write")
    }
}
