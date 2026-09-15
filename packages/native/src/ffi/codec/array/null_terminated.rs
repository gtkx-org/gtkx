use std::ffi::{CStr, c_char};

use super::super::prelude::*;
use super::container::{ArrayContainer, ArrayRead, BufferViewSupport};
use super::item::ItemCodec;
use super::{ArrayCodec, ArrayKindEncoder, build_js_array, dup_bytes_to_glib, transfer_items};
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

fn byte_ptrs_to_unknowns<'e>(env: &'e Env, items: &[*const c_char]) -> anyhow::Result<Unknown<'e>> {
    let unknowns = items
        .iter()
        .map(|&item| {
            let source = unsafe { CStr::from_ptr(item) }.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };
            Ok(bytes?)
        })
        .collect::<anyhow::Result<Vec<_>>>()?;
    build_js_array(env, unknowns)
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

pub(super) fn terminated_ptrs(ptr: *mut c_void) -> impl Iterator<Item = *mut c_void> {
    let ptr_array = ptr as *const *mut c_void;
    let mut i = 0isize;
    std::iter::from_fn(move || {
        let item_ptr = unsafe { *ptr_array.offset(i) };
        if item_ptr.is_null() {
            return None;
        }
        i += 1;
        Some(item_ptr)
    })
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
    fn encode_byte_strings(
        &self,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        match (ownership, dup_items) {
            (Ownership::Borrowed, false) => {
                let strings = ArrayCodec::extract_byte_strings(array)?;
                let mut ptrs: Vec<*mut c_void> = strings
                    .iter()
                    .map(|string| string.as_ptr() as *mut c_void)
                    .collect();
                ptrs.push(std::ptr::null_mut());
                let ptr = ptrs.as_mut_ptr().cast::<c_void>();
                Ok(ffi::Stash::Storage(StashStorage::new(
                    ptr,
                    StashData::StringArray(strings, ptrs),
                )))
            }
            (Ownership::Full, true) => {
                let mut ptrs = dup_bytes_to_glib(array)?;
                ptrs.push(std::ptr::null_mut());
                let container = leak_container_to_callee(&ptrs);
                Ok(full_transfer_stash(container, ffi::ReleaseKind::StrFreeV))
            }
            (Ownership::Full, false) => {
                let cstrings = ArrayCodec::extract_byte_strings(array)?;
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
                let mut ptrs = dup_bytes_to_glib(array)?;
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
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        let ffi::Stash::Ptr(ptr) = stash else {
            anyhow::bail!("A {name} can only be decoded from a raw pointer")
        };
        if ptr.is_null() {
            return Ok(value::js_null(env)?);
        }
        if self.is_bytes {
            return Self::decode_zero_terminated_bytes(env, *ptr, read.transfer());
        }
        if let Some(stride) = self.inline_element_size() {
            return Self::decode_zero_terminated_contiguous(
                env,
                stride,
                *ptr,
                read.transfer(),
                |env, base, len| self.decode_inline(env, stride, base, len, read),
            );
        }

        if matches!(&*self.item_codec, Codec::Array(_)) {
            return self.decode_null_terminated_ptr_array(env, *ptr, read);
        }

        match self.item_codec("array")? {
            ItemCodec::Bytes => {
                self.decode_null_terminated_string_array(env, *ptr, read.transfer())
            }
            ItemCodec::Pointer => self.decode_null_terminated_ptr_array(env, *ptr, read),
            codec @ (ItemCodec::Integer(_) | ItemCodec::BigInt(_) | ItemCodec::Float(_)) => {
                Self::decode_zero_terminated_contiguous(
                    env,
                    codec.element_size(),
                    *ptr,
                    read.transfer(),
                    |env, base, len| self.decode_contiguous(env, codec, base, len, read),
                )
            }
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
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        let items = terminated_ptrs(ptr);

        let is_full = read.transfer().is_full();
        self.decode_ptr_iter(env, items, read, move || {
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
        let items_full = matches!(&*self.item_codec, Codec::Bytes(bytes_codec) if bytes_codec.ownership.is_full());

        let _storage = transfer.is_full().then(|| {
            full_transfer_stash(
                ptr,
                if items_full {
                    ffi::ReleaseKind::StrFreeV
                } else {
                    ffi::ReleaseKind::GFree
                },
            )
        });
        let length = unsafe { glib::ffi::g_strv_length(ptr.cast::<*mut c_char>()) } as usize;
        let items = unsafe { std::slice::from_raw_parts(ptr.cast::<*const c_char>(), length) };
        byte_ptrs_to_unknowns(env, items)
    }
}
