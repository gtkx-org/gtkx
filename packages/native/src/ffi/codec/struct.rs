use anyhow::bail;

use super::prelude::*;
use crate::handle::Handle;
use crate::host::error_reporter::ReportErr as _;

const LENT_ONLY: &str = "a plain struct is not registered as a boxed type, so nothing names the function that would free it: it can only be lent (transfer none), never handed over";

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

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        self.ensure_lent()?;

        Ok(ptr)
    }
}

impl StructCodec {
    fn ensure_lent(&self) -> anyhow::Result<()> {
        Self::ensure_lent_transfer(self.ownership)
    }

    fn ensure_lent_transfer(transfer: Ownership) -> anyhow::Result<()> {
        anyhow::ensure!(transfer.is_borrowed(), "{LENT_ONLY}");

        Ok(())
    }

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
            unsafe { slot.store(src_ptr) };
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
        self.ensure_lent()?;

        self.decode_call_non_null(env, stash, "Struct", |struct_ptr| {
            Ok(value::handle_to_unknown(
                env,
                self.borrow_or_copy(struct_ptr),
            )?)
        })
    }

    read_value_non_null!(|self, env, ptr, transfer| {
        Self::ensure_lent_transfer(transfer)?;

        let handle = if self.caller_allocated {
            Handle::from_glib_borrow(ptr)
        } else {
            self.borrow_or_copy(ptr)
        };

        Ok(value::handle_to_unknown(env, handle)?)
    });
}

impl PtrWriter for StructCodec {
    fn write_return_to_ptr(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        if self.ensure_lent().report_err("Struct return").is_none() {
            unsafe { ret.store(std::ptr::null_mut()) };
            return;
        }

        write_return_object_ptr(ret, value, |ptr| ptr);
    }

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

        self.ensure_lent()?;

        match self.size {
            Some(size) => Self::write_pointer_slot(slot, value, init, size),
            None => write_object_ptr(slot, value, "Struct field write"),
        }
    }
}
