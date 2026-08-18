use anyhow::bail;
use glib::translate::IntoGlib as _;
use glib::{self};

use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{Boxed, BoxedFreeFn, Handle};
use crate::host::error_reporter::ReportErr as _;

#[derive(Debug, Clone)]
pub struct BoxedCodec {
    pub ownership: Ownership,
    pub type_name: String,
    pub shared_library: Option<String>,
    pub get_type_fn_name: Option<String>,
    pub free_fn_name: Option<String>,
    pub caller_allocated: bool,
    pub size: Option<usize>,
    pub inline: bool,
}

unsafe fn write_inline_value(
    slot: ffi::Slot,
    src_ptr: *mut c_void,
) -> anyhow::Result<Option<ffi::PendingTransfer>> {
    let dest = slot.as_ptr().cast::<glib::gobject_ffi::GValue>();
    let src = src_ptr.cast::<glib::gobject_ffi::GValue>();
    let src_type = unsafe { (*src).g_type };

    if src_type == glib::Type::INVALID.into_glib() {
        bail!("Cannot write an uninitialized GValue into the inline boxed field 'GValue'")
    }

    unsafe {
        if (*dest).g_type != glib::Type::INVALID.into_glib() {
            glib::gobject_ffi::g_value_unset(dest);
        }
        glib::gobject_ffi::g_value_init(dest, src_type);
        glib::gobject_ffi::g_value_copy(src, dest);
    }

    Ok(None)
}

impl BoxedCodec {
    pub fn type_(&self) -> anyhow::Result<Option<glib::Type>> {
        if let Some(type_) = glib::Type::from_name(&self.type_name) {
            return Ok(Some(type_));
        }
        self.try_resolve_type_from_library()
    }

    fn lookup_free_fn(library_name: &str, free_fn_name: &str) -> anyhow::Result<BoxedFreeFn> {
        FfiCache::with(|state| unsafe {
            state.resolve_symbol::<BoxedFreeFn>(library_name, free_fn_name)
        })
    }

    fn boxed_with_free_fn(
        &self,
        ptr: *mut c_void,
        free_fn_name: &str,
        transfer: Ownership,
    ) -> anyhow::Result<Handle> {
        let library_name = self.shared_library.as_deref().unwrap_or("(no library)");

        let free_fn = Self::lookup_free_fn(library_name, free_fn_name)
            .map_err(|e| anyhow::anyhow!("Cannot decode boxed '{}': {e}", self.type_name))?;

        if transfer.is_full() {
            Ok(Boxed::from_glib_full_with_free_fn(ptr, free_fn).into())
        } else {
            Ok(Handle::from_glib_borrow(ptr))
        }
    }

    fn adopted(&self, ptr: *mut c_void) -> anyhow::Result<Handle> {
        let Some(type_) = self.type_()? else {
            bail!(
                "Cannot take ownership of boxed type '{}': no type available, so nothing names the \
                 function that would free it",
                self.type_name
            );
        };
        Ok(Boxed::from_glib_full(type_, ptr).into())
    }

    fn copied(&self, ptr: *mut c_void) -> anyhow::Result<Handle> {
        let Some(type_) = self.type_()? else {
            bail!(
                "Cannot copy boxed type '{}': no type available. \
                 Pointer {ptr:p} may become dangling if the source is freed",
                self.type_name
            );
        };
        Ok(unsafe { Boxed::from_glib_none(type_, ptr) }.into())
    }

    fn write_inline(
        &self,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let Some(size) = self.size else {
            bail!(
                "Cannot write the inline boxed field '{}': its size is unknown",
                self.type_name
            )
        };
        let src_ptr = value::handle_ptr(value, "Boxed field write")?;
        if src_ptr.is_null() {
            bail!(
                "Cannot write null into the inline boxed field '{}'",
                self.type_name
            )
        }
        if is_slot_its_own_source(slot, src_ptr) {
            return Ok(None);
        }
        match self.type_name.as_str() {
            "GValue" => return unsafe { write_inline_value(slot, src_ptr) },
            "GClosure" => bail!(
                "Cannot write the inline boxed field 'GClosure': it has no copy-into-place operation, \
                 so the reference count of the closure already in the slot cannot be preserved"
            ),
            _ => {}
        }
        copy_into_slot(slot, src_ptr, size);
        Ok(None)
    }

    fn try_resolve_type_from_library(&self) -> anyhow::Result<Option<glib::Type>> {
        let (Some(library_name), Some(get_type_fn_name)) =
            (self.shared_library.as_ref(), self.get_type_fn_name.as_ref())
        else {
            return Ok(None);
        };

        let type_ = FfiCache::with(|state| state.resolve_type(library_name, get_type_fn_name))?;
        Ok(Some(type_).filter(|t| t.is_valid()))
    }
}

impl Encoder for BoxedCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Boxed object"
    }

    fn transfer_release(&self) -> Option<ffi::ReleaseKind> {
        if self.ownership.is_borrowed() {
            return None;
        }
        self.type_()
            .report_err("Boxed transfer release: cannot resolve type")
            .flatten()
            .map(ffi::ReleaseKind::BoxedFree)
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        ref_for_full_transfer(self.ownership, ptr, |ptr| {
            let Some(type_) = self.type_()? else {
                anyhow::bail!(
                    "Cannot transfer ownership of boxed '{}': its GType cannot be resolved, so no copy can be made for the callee",
                    self.type_name
                );
            };
            Ok(unsafe { Boxed::boxed_copy(type_, ptr) })
        })
    }
}

impl Decoder for BoxedCodec {
    fn is_inline(&self) -> bool {
        self.inline
    }

    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Boxed", |ptr| {
            if let Some(free_fn_name) = self.free_fn_name.as_deref() {
                return Ok(value::handle_to_unknown(
                    env,
                    self.boxed_with_free_fn(ptr, free_fn_name, self.ownership)?,
                )?);
            }

            let handle = match self.ownership {
                Ownership::Full => match self.type_()? {
                    Some(type_) => Boxed::from_glib_full(type_, ptr).into(),
                    None => Handle::owned_struct(ptr),
                },
                Ownership::Borrowed => self.copied(ptr)?,
            };

            Ok(value::handle_to_unknown(env, handle)?)
        })
    }

    read_value_non_null!(|self, env, ptr, transfer| {
        if self.caller_allocated {
            return Ok(value::handle_to_unknown(
                env,
                Handle::from_glib_borrow(ptr),
            )?);
        }
        if let Some(free_fn_name) = self.free_fn_name.as_deref() {
            return Ok(value::handle_to_unknown(
                env,
                self.boxed_with_free_fn(ptr, free_fn_name, transfer)?,
            )?);
        }
        if transfer.is_full() {
            return Ok(value::handle_to_unknown(env, self.adopted(ptr)?)?);
        }
        Ok(value::handle_to_unknown(env, self.copied(ptr)?)?)
    });
}

impl PtrWriter for BoxedCodec {
    write_return_transferred!("Boxed return: cannot transfer ownership");

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
        let Some(type_) = self.type_()? else {
            return write_object_ptr(slot, value, "Boxed field write");
        };
        if self.ownership.is_borrowed() {
            return store_acquired_slot(
                slot,
                value,
                "Boxed field write",
                |new_ptr| unsafe { Boxed::boxed_copy(type_, new_ptr) },
                Some(ffi::ReleaseKind::BoxedFree(type_)),
            );
        }
        swap_owned_slot(
            slot,
            value,
            init,
            "Boxed field write",
            |new_ptr| unsafe { Boxed::boxed_copy(type_, new_ptr) },
            |old_ptr| unsafe {
                glib::gobject_ffi::g_boxed_free(type_.into_glib(), old_ptr);
            },
        )
    }
}
