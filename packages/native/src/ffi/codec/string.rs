use std::ffi::{CString, c_char};

use anyhow::bail;
use glib::translate::ToGlibPtr;

use super::prelude::*;

pub fn str_to_glib_full(s: &str) -> anyhow::Result<*mut c_char> {
    if s.as_bytes().contains(&0) {
        bail!("String contains an interior NUL byte");
    }
    Ok(ToGlibPtr::<*mut c_char>::to_glib_full(s))
}

fn read_string(value: Unknown<'_>) -> anyhow::Result<Option<String>> {
    match value.get_type()? {
        ValueType::String => Ok(Some(value::read_napi::<String>(value)?)),
        ValueType::Null | ValueType::Undefined => Ok(None),
        other => bail_expected!(format!("a String, got {other:?}"), "string"),
    }
}

#[derive(Debug, Clone, Copy)]
pub struct StringCodec {
    pub ownership: Ownership,
    pub length: Option<usize>,
    /// Whether the instance holding a written slot owns the string in it. Only then is the string a
    /// write displaces released, which a `const char *` field the record does not own must not be.
    pub has_owned_storage: bool,
}

impl Encoder for StringCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let Some(s) = read_string(value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        if self.ownership.is_full() {
            let glib_ptr = str_to_glib_full(&s)?.cast::<c_void>();
            Ok(full_transfer_stash(glib_ptr, ffi::ReleaseKind::GFree))
        } else {
            let cstring = CString::new(s.as_bytes())?;
            let ptr = cstring.as_ptr() as *mut c_void;
            Ok(ffi::Stash::Storage(ffi::StashStorage::new(
                ptr,
                ffi::StashData::CString(cstring),
            )))
        }
    }
}

impl Decoder for StringCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "string", |str_ptr| {
            let string = unsafe { lossy_c_string(str_ptr as *const c_char) };
            if self.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr) };
            }
            Ok(string.into_unknown(env)?)
        })
    }

    read_value_non_null!(|self, env, ptr, _transfer| {
        let string = unsafe { lossy_c_string(ptr as *const c_char) };
        Ok(string.into_unknown(env)?)
    });
}

impl PtrWriter for StringCodec {
    fn write_return_to_ptr(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let ptr = match value {
            Ok(unknown) => read_string(*unknown)
                .ok()
                .flatten()
                .and_then(|s| str_to_glib_full(&s).ok())
                .map_or(std::ptr::null_mut(), <*mut c_char>::cast::<c_void>),
            Err(()) => std::ptr::null_mut(),
        };
        unsafe { ret.store(ptr) };
    }

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let new_ptr = match read_string(value)? {
            Some(s) => str_to_glib_full(&s)?.cast::<c_void>(),
            None => std::ptr::null_mut(),
        };
        let displaces =
            init.is_initialized() && (self.has_owned_storage || self.ownership.is_full());
        let old_ptr = if displaces {
            unsafe { slot.swap(new_ptr) }
        } else {
            unsafe { slot.store(new_ptr) };
            std::ptr::null_mut()
        };
        if !old_ptr.is_null() {
            unsafe { glib::ffi::g_free(old_ptr) };
        }
        if self.ownership.is_borrowed() {
            return Ok(Some(ffi::PendingTransfer::new(
                new_ptr,
                ffi::ReleaseKind::GFree,
            )));
        }
        Ok(None)
    }
}
