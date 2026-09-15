use std::ffi::{CStr, CString, c_char};

use super::prelude::*;

pub fn bytes_to_glib_full(bytes: &[u8]) -> anyhow::Result<*mut c_char> {
    let bytes = CString::new(bytes)?;
    Ok(unsafe { glib::ffi::g_strdup(bytes.as_ptr()) })
}

pub fn read_bytes(value: Unknown<'_>) -> anyhow::Result<Option<Vec<u8>>> {
    if matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) {
        return Ok(None);
    }
    let env = Env::from(value.value().env);
    let view = value::TypedView::from_unknown(&env, value)?
        .ok_or_else(|| anyhow::anyhow!("Expected Uint8Array"))?;
    anyhow::ensure!(view.kind() == value::ViewKind::Uint8, "Expected Uint8Array");
    Ok(Some(view.to_vec()))
}

#[derive(Debug, Clone, Copy)]
pub struct BytesCodec {
    pub ownership: Ownership,
    pub length: Option<usize>,
    /// Whether the instance holding a written slot owns the string in it. Only then is the string a
    /// write displaces released, which a `const char *` field the record does not own must not be.
    pub has_owned_storage: bool,
}

impl Encoder for BytesCodec {
    fn owned_release(&self) -> anyhow::Result<Option<ffi::ReleaseKind>> {
        Ok(self.ownership.is_full().then_some(ffi::ReleaseKind::GFree))
    }

    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let Some(bytes) = read_bytes(value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        if self.ownership.is_full() {
            let glib_ptr = bytes_to_glib_full(&bytes)?.cast::<c_void>();
            Ok(full_transfer_stash(glib_ptr, ffi::ReleaseKind::GFree))
        } else {
            let cstring = CString::new(bytes)?;
            let ptr = cstring.as_ptr() as *mut c_void;
            Ok(ffi::Stash::Storage(ffi::StashStorage::new(
                ptr,
                ffi::StashData::CString(cstring),
            )))
        }
    }
}

impl Decoder for BytesCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "string", |str_ptr| {
            let source = unsafe { CStr::from_ptr(str_ptr.cast::<c_char>()) }.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };
            if self.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr) };
            }
            Ok(bytes?)
        })
    }

    read_value_non_null!(|self, env, ptr, transfer| {
        let source = unsafe { CStr::from_ptr(ptr.cast::<c_char>()) }.to_bytes();
        let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };
        if transfer.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }
        Ok(bytes?)
    });
}

impl PtrWriter for BytesCodec {
    fn write_return_to_ptr(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let ptr = match value {
            Ok(unknown) => read_bytes(*unknown)
                .ok()
                .flatten()
                .and_then(|s| bytes_to_glib_full(&s).ok())
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
        let new_ptr = match read_bytes(value)? {
            Some(bytes) => bytes_to_glib_full(&bytes)?.cast::<c_void>(),
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
