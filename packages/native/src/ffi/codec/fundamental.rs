use super::prelude::*;
use crate::ffi::library_cache::FfiCache;
use crate::handle::{Fundamental, Handle, RefFn, UnrefFn};
use crate::messaging::error_reporter::ReportErr as _;

#[derive(Debug, Clone)]
pub struct FundamentalCodec {
    pub ownership: Ownership,
    pub shared_library: String,
    pub ref_fn_name: String,
    pub unref_fn_name: String,
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
            Fundamental::from_glib_full(ptr, ref_fn, unref_fn)
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
        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                return Ok(unsafe { ref_fn(ptr) });
            }
        }
        Ok(ptr)
    }
}

impl Decoder for FundamentalCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Fundamental", |ptr| {
            Ok(value::handle_to_unknown(env, self.wrap_ptr(ptr)?)?)
        })
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| {
            let (ref_fn, unref_fn) = self.lookup_fns()?;
            let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
            Ok(value::handle_to_unknown(env, fundamental.into())?)
        })
    }
}

impl PtrWriter for FundamentalCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        self.write_return_with_ownership(env, ret, value, self.ownership, |ptr| {
            unsafe { self.ref_for_transfer(ptr) }
                .report_err("Fundamental return: cannot transfer ownership")
                .unwrap_or(std::ptr::null_mut())
        });
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<()> {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        swap_owned_slot(
            env,
            slot,
            value,
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
