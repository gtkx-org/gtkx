use glib::{self, translate::IntoGlib as _};

use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{Boxed, BoxedFreeFn};
use crate::messaging::error_reporter::ReportErr as _;

#[derive(Debug, Clone)]
pub struct BoxedCodec {
    pub ownership: Ownership,
    pub type_name: String,
    pub shared_library: Option<String>,
    pub get_type_fn_name: Option<String>,
    pub free_fn_name: Option<String>,
    pub caller_allocated: bool,
}

impl BoxedCodec {
    pub fn type_(&self) -> anyhow::Result<Option<glib::Type>> {
        if let Some(type_) = glib::Type::from_name(&self.type_name) {
            return Ok(Some(type_));
        }
        self.try_resolve_type_from_library()
    }

    fn lookup_free_fn(library_name: &str, free_fn_name: &str) -> anyhow::Result<BoxedFreeFn> {
        FfiCache::with(|state| state.resolve_symbol::<BoxedFreeFn>(library_name, free_fn_name))
    }

    fn boxed_with_free_fn(&self, ptr: *mut c_void, free_fn_name: &str) -> anyhow::Result<Boxed> {
        let library_name = self.shared_library.as_deref().unwrap_or("(no library)");

        let free_fn = Self::lookup_free_fn(library_name, free_fn_name)
            .map_err(|e| anyhow::anyhow!("Cannot decode boxed '{}': {e}", self.type_name))?;

        if self.ownership.is_full() {
            Ok(Boxed::from_glib_full_with_free_fn(ptr, free_fn))
        } else {
            Ok(Boxed::from_glib_borrow(ptr))
        }
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
        if !self.ownership.is_full() || ptr.is_null() {
            return Ok(ptr);
        }
        let Some(type_) = self.type_()? else {
            anyhow::bail!(
                "Cannot transfer ownership of boxed '{}': its GType cannot be resolved, so no copy can be made for the callee",
                self.type_name
            );
        };
        Ok(unsafe { Boxed::boxed_copy(type_, ptr) })
    }
}

impl Decoder for BoxedCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Boxed", |ptr| {
            if let Some(free_fn_name) = self.free_fn_name.as_deref() {
                return Ok(value::handle_to_unknown(
                    env,
                    self.boxed_with_free_fn(ptr, free_fn_name)?.into(),
                )?);
            }

            let type_ = self.type_()?;
            let boxed = match self.ownership {
                Ownership::Full => Boxed::from_glib_full(type_, ptr),
                Ownership::Borrowed => unsafe {
                    Boxed::from_glib_none(type_, ptr, Some(&self.type_name))?
                },
            };

            Ok(value::handle_to_unknown(env, boxed.into())?)
        })
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| {
            if self.free_fn_name.is_some() || self.caller_allocated {
                return Ok(value::handle_to_unknown(
                    env,
                    Boxed::from_glib_borrow(ptr).into(),
                )?);
            }
            Ok(value::handle_to_unknown(
                env,
                unsafe { Boxed::from_glib_none(self.type_()?, ptr, None) }?.into(),
            )?)
        })
    }
}

impl PtrWriter for BoxedCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        self.write_return_with_ownership(env, ret, value, self.ownership, |ptr| {
            unsafe { self.ref_for_transfer(ptr) }
                .report_err("Boxed return: cannot transfer ownership")
                .unwrap_or(std::ptr::null_mut())
        });
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<()> {
        let Some(type_) = self.type_()? else {
            return write_object_ptr(env, slot, value, "Boxed field write");
        };
        swap_owned_slot(
            env,
            slot,
            value,
            "Boxed field write",
            |new_ptr| unsafe { Boxed::boxed_copy(type_, new_ptr) },
            |old_ptr| unsafe {
                glib::gobject_ffi::g_boxed_free(type_.into_glib(), old_ptr);
            },
        )
    }
}
