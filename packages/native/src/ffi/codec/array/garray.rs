use anyhow::bail;

use super::super::prelude::*;
use super::container::ArrayContainer;
use super::item::ItemCodec;
use super::{ArrayCodec, dup_strings_to_glib, transfer_items};
use crate::ffi::codec::{Codec, FloatCodec};
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub(crate) struct GArrayCodec;

impl ArrayContainer for GArrayCodec {
    fn encode(&self, codec: &ArrayCodec, array: &[value::Value]) -> anyhow::Result<ffi::Stash> {
        let item_size = codec.item_element_size();
        let element_size = codec.element_size.or(item_size).ok_or_else(|| {
            anyhow::anyhow!(
                "Cannot determine element size for GArray with item codec {:?}",
                codec.item_codec
            )
        })?;

        if let Some(item_size) = item_size
            && element_size != item_size
        {
            bail!(
                "GArray element size override {element_size} does not match the {item_size}-byte layout of item codec {:?}",
                codec.item_codec
            );
        }

        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, element_size as u32, array.len() as u32) };

        let acquired = match codec.append_items_to_garray(g_array, array) {
            Ok(acquired) => acquired,
            Err(err) => {
                unsafe { glib::ffi::g_array_unref(g_array) };
                return Err(err);
            }
        };

        let should_free = codec.ownership.is_borrowed();
        let storage = StashStorage::new(
            g_array as *mut c_void,
            StashData::GArray(ffi::GArrayData {
                ptr: g_array,
                should_free,
            }),
        );
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            ffi::ReleaseKind::GArrayUnref,
        ))
    }

    fn decode(&self, codec: &ArrayCodec, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        let Some(ptr) = stash.as_non_null_ptr("GArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let item = codec.item_codec("GArray")?;
        let g_array = ptr as *const glib::ffi::GArray;
        let data = unsafe { (*g_array).data as *const u8 };
        let len = unsafe { (*g_array).len as usize };
        let values = codec.decode_contiguous(item, data, len);

        if codec.ownership.is_full() {
            let storage_owns = matches!(stash, ffi::Stash::Storage(_));
            if !storage_owns {
                unsafe { glib::ffi::g_array_unref(ptr as *mut glib::ffi::GArray) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    fn name(&self) -> &'static str {
        "GArray"
    }
}

impl ArrayCodec {
    fn append_vals(g_array: *mut glib::ffi::GArray, data: *const c_void, len: usize) {
        unsafe {
            glib::ffi::g_array_append_vals(g_array, data, len as u32);
        }
    }

    fn append_handle_values_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        let handles = Self::extract_handles(array)?;
        let (ptrs, acquired) = transfer_items(&handles, &self.item_codec, "GArray")?;
        Self::append_vals(g_array, ptrs.as_ptr().cast::<c_void>(), ptrs.len());
        Ok(acquired)
    }

    fn append_items_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        match self.item_codec("GArray")? {
            ItemCodec::Integer(kind) | ItemCodec::EnumFlags(kind) => {
                let storage = kind.to_stash_storage(&Self::extract_numbers(array)?);
                Self::append_vals(g_array, storage.ptr(), array.len());
                Ok(Vec::new())
            }
            ItemCodec::BigInt(kind) => {
                let storage = kind.to_stash_storage(array)?;
                Self::append_vals(g_array, storage.ptr(), array.len());
                Ok(Vec::new())
            }
            ItemCodec::Float(kind) => {
                let numbers = Self::extract_numbers(array)?;
                let storage: StashStorage = match kind {
                    FloatCodec::F32 => numbers
                        .iter()
                        .map(|&v| v as f32)
                        .collect::<Vec<f32>>()
                        .into(),
                    FloatCodec::F64 => numbers.into(),
                };
                Self::append_vals(g_array, storage.ptr(), array.len());
                Ok(Vec::new())
            }
            ItemCodec::Boolean => {
                let storage: StashStorage = Self::extract_booleans(array)?.into();
                Self::append_vals(g_array, storage.ptr(), array.len());
                Ok(Vec::new())
            }
            ItemCodec::Pointer => self.append_handle_values_to_garray(g_array, array),
            ItemCodec::String => {
                unsafe extern "C" fn free_garray_string_element(slot: glib::ffi::gpointer) {
                    unsafe { glib::ffi::g_free(*(slot as *mut glib::ffi::gpointer)) };
                }
                let callee_owns_strings =
                    matches!(&*self.item_codec, Codec::String(s) if s.ownership.is_full());
                if !callee_owns_strings {
                    unsafe {
                        glib::ffi::g_array_set_clear_func(
                            g_array,
                            Some(free_garray_string_element),
                        );
                    }
                }
                let dups = dup_strings_to_glib(array)?;
                let acquired = if callee_owns_strings {
                    dups.iter()
                        .map(|&dup| ffi::PendingTransfer::new(dup, ffi::ReleaseKind::GFree))
                        .collect()
                } else {
                    Vec::new()
                };
                Self::append_vals(g_array, dups.as_ptr().cast::<c_void>(), dups.len());
                Ok(acquired)
            }
        }
    }
}
