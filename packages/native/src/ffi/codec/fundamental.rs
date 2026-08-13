use anyhow::bail;

use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{Fundamental, Handle, RefFn, UnrefFn};

#[derive(Debug, Clone)]
pub struct FundamentalCodec {
    pub ownership: Ownership,
    pub shared_library: String,
    pub ref_fn_name: String,
    pub unref_fn_name: String,
    pub inline: bool,
}

impl FundamentalCodec {
    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        FfiCache::with(|state| {
            state.lookup_fundamental_fns(
                &self.shared_library,
                &self.ref_fn_name,
                &self.unref_fn_name,
            )
        })
    }

    fn wrap_ptr(&self, ptr: *mut c_void) -> anyhow::Result<Handle> {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = if self.ownership.is_full() {
            unsafe { Fundamental::from_glib_full(ptr, unref_fn) }
        } else {
            unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) }
        };
        Ok(fundamental.into())
    }
}

impl Encoder for FundamentalCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Fundamental"
    }

    fn transfer_release(&self) -> Option<ffi::ReleaseKind> {
        if self.ownership.is_borrowed() {
            return None;
        }
        let Ok((Some(_), Some(unref_fn))) = self.lookup_fns() else {
            return None;
        };
        Some(ffi::ReleaseKind::Fundamental(unref_fn))
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        ref_for_full_transfer(self.ownership, ptr, |ptr| {
            let (ref_fn, _) = self.lookup_fns()?;
            match ref_fn {
                Some(ref_fn) => Ok(unsafe { ref_fn(ptr) }),
                None => Ok(ptr),
            }
        })
    }
}

impl Decoder for FundamentalCodec {
    fn is_inline(&self) -> bool {
        self.inline
    }

    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Fundamental", |ptr| {
            Ok(value::handle_to_unknown(env, self.wrap_ptr(ptr)?)?)
        })
    }

    read_value_non_null!(|self, env, ptr, _transfer| {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
        Ok(value::handle_to_unknown(env, fundamental.into())?)
    });
}

impl PtrWriter for FundamentalCodec {
    write_return_transferred!("Fundamental return: cannot transfer ownership");

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        if self.inline {
            bail!("Cannot write the inline fundamental field: its size is unknown")
        }
        if self.ownership.is_borrowed() {
            return store_acquired_slot(
                slot,
                value,
                "Fundamental field write",
                |new_ptr| unsafe { ref_fn.map_or(new_ptr, |f| f(new_ptr)) },
                ref_fn.and(unref_fn).map(ffi::ReleaseKind::Fundamental),
            );
        }
        swap_owned_slot(
            slot,
            value,
            init,
            "Fundamental field write",
            |new_ptr| unsafe { ref_fn.map_or(new_ptr, |f| f(new_ptr)) },
            |old_ptr| unsafe {
                if let Some(unref_fn) = unref_fn {
                    unref_fn(old_ptr);
                }
            },
        )
    }
}
