use anyhow::bail;

use super::prelude::*;
use crate::handle::Handle;

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

    fn transfer_release(&self) -> Option<ffi::ReleaseKind> {
        if self.ownership.is_borrowed() || self.size.is_none() {
            return None;
        }
        Some(ffi::ReleaseKind::GFree)
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        ref_for_full_transfer(self.ownership, ptr, |ptr| {
            let Some(size) = self.size else {
                bail!(
                    "Cannot transfer ownership of struct: its size is unknown, so no copy can be made for the callee"
                );
            };
            Ok(unsafe { glib::ffi::g_memdup2(ptr as *const c_void, size) })
        })
    }
}

impl StructCodec {
    fn borrow_or_copy(&self, ptr: *mut c_void) -> Handle {
        self.size.map_or_else(
            || Handle::from_glib_borrow(ptr),
            |size| Handle::Struct(unsafe { glib::ffi::g_memdup2(ptr as *const c_void, size) }),
        )
    }
}

impl Decoder for StructCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Struct", |struct_ptr| {
            let handle = match self.ownership {
                Ownership::Full => Handle::Struct(struct_ptr),
                Ownership::Borrowed => self.borrow_or_copy(struct_ptr),
            };

            Ok(value::handle_to_unknown(env, handle)?)
        })
    }

    read_value_non_null!(|self, env, ptr| {
        let handle = if self.caller_allocated {
            Handle::from_glib_borrow(ptr)
        } else {
            self.borrow_or_copy(ptr)
        };

        Ok(value::handle_to_unknown(env, handle)?)
    });
}

impl PtrWriter for StructCodec {
    write_return_transferred!("Struct return: cannot transfer ownership");

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value::handle_ptr(value, "Struct field write")?;
            if src_ptr.is_null() {
                unsafe { slot.store(std::ptr::null_mut()) };
                return Ok(());
            }
            if !init.is_initialized() {
                let out_ptr = if self.ownership.is_full() {
                    unsafe { glib::ffi::g_memdup2(src_ptr as *const c_void, size) }
                } else {
                    src_ptr
                };
                unsafe { slot.store(out_ptr) };
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
        write_object_ptr(slot, value, "Struct field write")
    }
}
