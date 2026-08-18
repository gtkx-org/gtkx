use anyhow::bail;
use napi_derive::napi;

use super::prelude::*;
use crate::handle::Handle;

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum StructInputPolicy {
    #[default]
    Borrow,
    Reject,
}

#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum StructOutputPolicy {
    Borrow,
    ShallowCopy,
    #[default]
    Reject,
}

#[derive(Debug, Clone)]
pub struct StructCodec {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub input_policy: StructInputPolicy,
    pub output_policy: StructOutputPolicy,
    pub caller_allocated: bool,
    pub inline: bool,
}

impl Encoder for StructCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        self.ensure_input_supported()?;

        Ok(ffi::Stash::Ptr(value::handle_ptr(
            value,
            self.object_ptr_context(),
        )?))
    }

    fn object_ptr_context(&self) -> &'static str {
        "Struct object"
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        self.ensure_input_supported()?;
        Ok(ptr)
    }
}

impl StructCodec {
    pub(crate) fn read_callback_arg<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| {
            Ok(value::handle_to_unknown(
                env,
                Handle::from_glib_borrow(ptr),
            )?)
        })
    }

    pub(crate) fn ensure_input_supported(&self) -> anyhow::Result<()> {
        if self.ownership.is_full() && !self.caller_allocated {
            bail!("Cannot transfer ownership of a plain struct input")
        }

        match self.input_policy {
            StructInputPolicy::Borrow => Ok(()),
            StructInputPolicy::Reject => {
                bail!("Cannot pass this plain struct as an input argument")
            }
        }
    }

    fn ensure_output_supported(&self, is_inline_array_item: bool) -> anyhow::Result<()> {
        match self.output_policy {
            StructOutputPolicy::Borrow => {
                if self.ownership.is_full() && !self.caller_allocated {
                    bail!("Cannot borrow a transfer-full plain struct output")
                }
                Ok(())
            }
            StructOutputPolicy::Reject => {
                bail!("Cannot marshal this plain struct as an output value")
            }
            StructOutputPolicy::ShallowCopy => {
                if self.ownership.is_full() && !self.caller_allocated && !is_inline_array_item {
                    bail!("Cannot marshal a transfer-full plain struct output")
                }
                if self.size.is_none() {
                    bail!("Cannot shallow-copy a plain struct whose size is unknown")
                }
                Ok(())
            }
        }
    }

    fn output_handle(
        &self,
        ptr: *mut c_void,
        is_inline_array_item: bool,
    ) -> anyhow::Result<Handle> {
        self.ensure_output_supported(is_inline_array_item)?;

        match self.output_policy {
            StructOutputPolicy::Borrow => Ok(Handle::from_glib_borrow(ptr)),
            StructOutputPolicy::ShallowCopy => {
                let Some(size) = self.size else {
                    bail!("Cannot shallow-copy a plain struct whose size is unknown")
                };

                Ok(Handle::owned_struct(unsafe {
                    glib::ffi::g_memdup2(ptr.cast_const(), size)
                }))
            }
            StructOutputPolicy::Reject => {
                bail!("Cannot marshal this plain struct as an output value")
            }
        }
    }

    pub(crate) fn read_inline_array_item<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| {
            Ok(value::handle_to_unknown(
                env,
                self.output_handle(ptr, true)?,
            )?)
        })
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
            let out_ptr = unsafe { self.ref_for_transfer(src_ptr)? };
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
            Ok(value::handle_to_unknown(
                env,
                self.output_handle(struct_ptr, false)?,
            )?)
        })
    }

    read_value_non_null!(|self, env, ptr, _transfer| {
        let handle = if self.caller_allocated {
            Handle::from_glib_borrow(ptr)
        } else {
            self.output_handle(ptr, false)?
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
        self.ensure_input_supported()?;
        if self.inline {
            return self.write_inline(slot, value);
        }
        match self.size {
            Some(size) => self.write_pointer_slot(slot, value, init, size),
            None => write_object_ptr(slot, value, "Struct field write"),
        }
    }
}
