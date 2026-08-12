use anyhow::bail;

use super::prelude::*;
use crate::handle::Handle;

#[derive(Debug, Clone)]
pub struct StructCodec {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
    pub inline: bool,
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
            Ok(unsafe { glib::ffi::g_memdup2(ptr.cast_const(), size) })
        })
    }
}

impl StructCodec {
    fn borrow_or_copy(&self, ptr: *mut c_void) -> Handle {
        self.size.map_or_else(
            || Handle::from_glib_borrow(ptr),
            |size| Handle::owned_struct(unsafe { glib::ffi::g_memdup2(ptr.cast_const(), size) }),
        )
    }

    fn write_inline(
        &self,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let Some(size) = self.size else {
            bail!("Cannot write an inline struct field whose size is unknown")
        };
        let src_ptr = value::handle_ptr(value, "Struct field write")?;
        if src_ptr.is_null() {
            bail!("Cannot write null into an inline struct field")
        }
        if is_slot_its_own_source(slot, src_ptr) {
            return Ok(None);
        }
        copy_into_slot(slot, src_ptr, size);
        Ok(None)
    }

    fn write_pointer_slot(
        &self,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
        size: usize,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let src_ptr = value::handle_ptr(value, "Struct field write")?;
        if src_ptr.is_null() {
            unsafe { slot.store(std::ptr::null_mut()) };
            return Ok(None);
        }
        if !init.is_initialized() {
            let out_ptr = if self.ownership.is_full() {
                unsafe { glib::ffi::g_memdup2(src_ptr.cast_const(), size) }
            } else {
                src_ptr
            };
            unsafe { slot.store(out_ptr) };
            return Ok(None);
        }
        let dest_ptr = unsafe { slot.load() };
        if dest_ptr.is_null() {
            bail!("Struct field write into null pointer slot")
        }
        unsafe {
            std::ptr::copy_nonoverlapping(src_ptr.cast::<u8>(), dest_ptr.cast::<u8>(), size);
        }
        Ok(None)
    }
}

impl Decoder for StructCodec {
    fn is_inline(&self) -> bool {
        self.inline
    }

    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Struct", |struct_ptr| {
            let handle = match self.ownership {
                Ownership::Full => Handle::owned_struct(struct_ptr),
                Ownership::Borrowed => self.borrow_or_copy(struct_ptr),
            };

            Ok(value::handle_to_unknown(env, handle)?)
        })
    }

    read_value_non_null!(|self, env, ptr, _transfer| {
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
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        if self.inline {
            return self.write_inline(slot, value);
        }
        match self.size {
            Some(size) => self.write_pointer_slot(slot, value, init, size),
            None => write_object_ptr(slot, value, "Struct field write"),
        }
    }
}
