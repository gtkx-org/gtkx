use std::ffi::c_char;

use super::super::prelude::*;
use super::container::{ArrayContainer, BufferViewSupport};
use super::item::ItemCodec;
use super::{
    ArrayCodec, ArrayKindEncoder, build_js_array, dup_strings_to_glib, read_string_item,
    transfer_items,
};
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

fn gstring_ptrs_to_unknowns<'e>(
    env: &'e Env,
    items: &[glib::GStringPtr],
) -> anyhow::Result<Unknown<'e>> {
    let unknowns = items
        .iter()
        .map(|item| {
            let string = unsafe { lossy_c_string(item.as_ptr()) };
            Ok(string.into_unknown(env)?)
        })
        .collect::<anyhow::Result<Vec<_>>>()?;
    build_js_array(env, unknowns)
}

fn build_strv(array: &[Unknown<'_>]) -> anyhow::Result<glib::StrV> {
    let mut strv = glib::StrV::with_capacity(array.len());
    for &v in array {
        let s = read_string_item(v)?;
        let gstring = glib::GString::from_string_checked(s)
            .map_err(|_| anyhow::anyhow!("String contains an interior NUL byte"))?;
        strv.push(gstring);
    }
    Ok(strv)
}

fn leak_container_to_callee(ptrs: &[*mut c_void]) -> *mut c_void {
    unsafe { glib::ffi::g_memdup2(ptrs.as_ptr().cast::<c_void>(), size_of_val(ptrs)) }
}

fn zero_terminated_len(base: *const u8, stride: usize) -> usize {
    let mut len = 0usize;
    loop {
        let element = unsafe { std::slice::from_raw_parts(base.add(len * stride), stride) };
        if element.iter().all(|&byte| byte == 0) {
            return len;
        }
        len += 1;
    }
}

#[derive(Debug, Clone)]
pub(crate) struct NullTerminatedArrayCodec;

impl ArrayContainer for NullTerminatedArrayCodec {
    fn encode(
        &self,
        codec: &ArrayCodec,
        env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        codec.encode_zero_terminated_items(env, &NullTerminatedArrayEncoder, array)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(None)
    }

    fn name(&self) -> &'static str {
        "array"
    }
}

pub(super) struct NullTerminatedArrayEncoder;

impl ArrayKindEncoder for NullTerminatedArrayEncoder {
    fn encode_strings(
        &self,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        match (ownership, dup_items) {
            (Ownership::Borrowed, false) => {
                let strv = build_strv(array)?;
                let ptr = strv.as_ptr() as *mut c_void;
                Ok(ffi::Stash::Storage(StashStorage::new(
                    ptr,
                    StashData::StrV(strv),
                )))
            }
            (Ownership::Full, true) => {
                let strv = build_strv(array)?;
                let container = strv.into_raw().cast::<c_void>();
                Ok(full_transfer_stash(container, ffi::ReleaseKind::StrFreeV))
            }
            (Ownership::Full, false) => {
                let cstrings = ArrayCodec::extract_strings(array)?;
                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
                ptrs.push(std::ptr::null_mut());
                let container = leak_container_to_callee(&ptrs);
                Ok(ffi::Stash::Storage(
                    StashStorage::new(container, StashData::StringArray(cstrings, Vec::new()))
                        .with_pending_transfer(container, ffi::ReleaseKind::GFree),
                ))
            }
            (Ownership::Borrowed, true) => {
                let mut ptrs = dup_strings_to_glib(array)?;
                ptrs.push(std::ptr::null_mut());
                let ptr = ptrs.as_mut_ptr().cast::<c_void>();
                Ok(ffi::Stash::Storage(
                    StashStorage::new(ptr, StashData::StringArray(Vec::new(), ptrs))
                        .with_pending_transfer(ptr, ffi::ReleaseKind::StringElements),
                ))
            }
        }
    }

    fn encode_handles(
        &self,
        handles: Vec<crate::handle::Handle>,
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let (mut ptrs, acquired) = transfer_items(&handles, item_codec, "array")?;
        ptrs.push(std::ptr::null_mut());

        let should_free = ownership.is_borrowed();
        let storage = if should_free {
            let ptr = ptrs.as_mut_ptr().cast::<c_void>();
            StashStorage::new(ptr, StashData::ObjectArray(handles, ptrs))
        } else {
            let container = leak_container_to_callee(&ptrs);
            StashStorage::new(container, StashData::ObjectArray(handles, Vec::new()))
        };
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            ffi::ReleaseKind::GFree,
        ))
    }
}

impl ArrayCodec {
    pub(super) fn decode_null_terminated<'e>(
        &self,
        env: &'e Env,
        name: &str,
        stash: &ffi::Stash,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let ffi::Stash::Ptr(ptr) = stash else {
            anyhow::bail!("A {name} can only be decoded from a raw pointer")
        };
        if ptr.is_null() {
            return self.decode_empty_sequence(env);
        }
        if self.is_bytes {
            return Self::decode_zero_terminated_bytes(env, *ptr, transfer);
        }
        if let Some(stride) = self.inline_element_size() {
            return Self::decode_zero_terminated_contiguous(
                env,
                stride,
                *ptr,
                transfer,
                |env, base, len| self.decode_inline(env, stride, base, len),
            );
        }

        match self.item_codec("array")? {
            ItemCodec::String => self.decode_null_terminated_string_array(env, *ptr, transfer),
            ItemCodec::Pointer => self.decode_null_terminated_ptr_array(env, *ptr, transfer),
            codec @ (ItemCodec::Integer(_)
            | ItemCodec::EnumFlags(_)
            | ItemCodec::BigInt(_)
            | ItemCodec::Float(_)
            | ItemCodec::Boolean
            | ItemCodec::Unichar) => Self::decode_zero_terminated_contiguous(
                env,
                codec.element_size(),
                *ptr,
                transfer,
                |env, base, len| self.decode_contiguous(env, codec, base, len),
            ),
        }
    }

    fn decode_zero_terminated_contiguous<'e, F>(
        env: &'e Env,
        stride: usize,
        ptr: *mut c_void,
        transfer: Ownership,
        decode: F,
    ) -> anyhow::Result<Unknown<'e>>
    where
        F: FnOnce(&'e Env, *const u8, usize) -> anyhow::Result<Vec<Unknown<'e>>>,
    {
        let base = ptr as *const u8;
        let values = decode(env, base, zero_terminated_len(base, stride));

        if transfer.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        build_js_array(env, values?)
    }

    fn decode_null_terminated_ptr_array<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let ptr_array = ptr as *const *mut c_void;
        let mut i = 0isize;
        let items = std::iter::from_fn(move || {
            let item_ptr = unsafe { *ptr_array.offset(i) };
            if item_ptr.is_null() {
                return None;
            }
            i += 1;
            Some(item_ptr)
        });

        let is_full = transfer.is_full();
        self.decode_ptr_iter(env, items, move || {
            if is_full {
                unsafe { glib::ffi::g_free(ptr) };
            }
        })
    }

    fn decode_zero_terminated_bytes(
        env: &Env,
        ptr: *mut c_void,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'_>> {
        let base = ptr as *const u8;
        let bytes = unsafe { value::js_byte_array(env, base, zero_terminated_len(base, 1)) };

        if transfer.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(bytes?)
    }

    fn decode_null_terminated_string_array<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let items_full = matches!(&*self.item_codec, Codec::String(string_codec) if string_codec.ownership.is_full());

        if transfer.is_full() {
            let strv = if items_full {
                unsafe { glib::StrV::from_glib_full(ptr.cast::<*mut c_char>()) }
            } else {
                unsafe { glib::StrV::from_glib_container(ptr.cast::<*const c_char>()) }
            };
            gstring_ptrs_to_unknowns(env, &strv)
        } else {
            let borrowed = unsafe { glib::StrVRef::from_glib_borrow(ptr as *const *const c_char) };
            gstring_ptrs_to_unknowns(env, borrowed)
        }
    }
}
