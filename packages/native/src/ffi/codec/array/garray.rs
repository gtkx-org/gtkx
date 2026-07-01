use anyhow::bail;

use super::super::prelude::*;
use super::{ArrayCodec, ItemCodec, dup_strings_to_glib, transfer_elements};
use crate::ffi::codec::{BigIntCodec, Codec, FloatCodec, IntegerCodec};
use crate::ffi::{Stash, StashStorage};

impl ArrayCodec {
    pub(super) fn encode_gbytearray(
        &self,
        array: &[value::Value],
    ) -> anyhow::Result<ffi::StashedValue> {
        let bytes: Vec<u8> = array
            .iter()
            .enumerate()
            .map(|(i, v)| match v {
                value::Value::Number(n) => {
                    IntegerCodec::U8
                        .check_range(*n)
                        .map_err(|e| anyhow::anyhow!("GByteArray element {i}: {e}"))?;
                    Ok(*n as u8)
                }
                _ => bail!("Expected a Number for GByteArray element, got {v:?}"),
            })
            .collect::<anyhow::Result<Vec<u8>>>()?;

        let byte_array = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(bytes.len() as u32);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), bytes.len() as u32);
            ba
        };

        let owned: Option<glib::ByteArray> = self
            .ownership
            .is_borrowed()
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let storage = Stash::new(byte_array as *mut c_void, StashStorage::GByteArray(owned));
        Ok(finalize_container_stash(
            storage,
            self.ownership.is_borrowed(),
            Vec::new(),
            ffi::PendingRelease::GByteArrayUnref,
        ))
    }

    fn append_integer_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        integer_codec: IntegerCodec,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        let mut buf = [0u8; size_of::<i64>()];
        for n in Self::extract_numbers(array)? {
            unsafe { integer_codec.write_ptr(buf.as_mut_ptr(), n) };
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_bigint_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        kind: BigIntCodec,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        let mut buf = [0u8; size_of::<i64>()];
        for v in array {
            unsafe { kind.append_into(buf.as_mut_ptr(), v)? };
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_float_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        float_codec: FloatCodec,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        for n in Self::extract_numbers(array)? {
            match float_codec {
                FloatCodec::F32 => {
                    let v = n as f32;
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &v as *const f32 as *const c_void,
                            1,
                        );
                    }
                }
                FloatCodec::F64 => unsafe {
                    glib::ffi::g_array_append_vals(g_array, &n as *const f64 as *const c_void, 1);
                },
            }
        }
        Ok(())
    }

    fn append_handle_values_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        let handles = Self::extract_handles(array)?;
        let (ptrs, acquired) = transfer_elements(&handles, &self.item_codec, "GArray")?;
        for ptr in ptrs {
            unsafe {
                glib::ffi::g_array_append_vals(
                    g_array,
                    &ptr as *const *mut c_void as *const c_void,
                    1,
                );
            }
        }
        Ok(acquired)
    }

    fn append_items_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        match self.item_codec("GArray")? {
            ItemCodec::Integer(kind) | ItemCodec::EnumFlags(kind) => {
                Self::append_integer_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::BigInt(kind) => {
                Self::append_bigint_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Float(kind) => {
                Self::append_float_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Boolean => {
                for b in Self::extract_booleans(array)? {
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &b as *const i32 as *const c_void,
                            1,
                        );
                    }
                }
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
                let mut acquired = Vec::new();
                for dup in dup_strings_to_glib(array)? {
                    if callee_owns_strings {
                        acquired.push(ffi::PendingTransfer::new(dup, ffi::PendingRelease::GFree));
                    }
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &dup as *const *mut c_void as *const c_void,
                            1,
                        );
                    }
                }
                Ok(acquired)
            }
        }
    }

    pub(super) fn encode_garray(
        &self,
        array: &[value::Value],
    ) -> anyhow::Result<ffi::StashedValue> {
        let item_size = self.item_element_size();
        let element_size = self.element_size.or(item_size).ok_or_else(|| {
            anyhow::anyhow!(
                "Cannot determine element size for GArray with item codec {:?}",
                self.item_codec
            )
        })?;

        if let Some(item_size) = item_size
            && element_size != item_size
        {
            bail!(
                "GArray element size override {element_size} does not match the {item_size}-byte layout of item codec {:?}",
                self.item_codec
            );
        }

        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, element_size as u32, array.len() as u32) };

        let acquired = match self.append_items_to_garray(g_array, array) {
            Ok(acquired) => acquired,
            Err(err) => {
                unsafe { glib::ffi::g_array_unref(g_array) };
                return Err(err);
            }
        };

        let should_free = self.ownership.is_borrowed();
        let storage = Stash::new(
            g_array as *mut c_void,
            StashStorage::GArray(ffi::GArrayData {
                array_ptr: g_array,
                should_free,
            }),
        );
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            ffi::PendingRelease::GArrayUnref,
        ))
    }

    pub(super) fn decode_garray(
        &self,
        stashed_value: &ffi::StashedValue,
    ) -> anyhow::Result<value::Value> {
        let Some(array_ptr) = stashed_value.as_non_null_ptr("GArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let codec = self.item_codec("GArray")?;
        let g_array = array_ptr as *const glib::ffi::GArray;
        let data = unsafe { (*g_array).data as *const u8 };
        let len = unsafe { (*g_array).len as usize };
        let values = self.decode_contiguous(codec, data, len);

        if self.ownership.is_full() {
            let storage_owns = matches!(stashed_value, ffi::StashedValue::Stashed(_));
            if !storage_owns {
                unsafe { glib::ffi::g_array_unref(array_ptr as *mut glib::ffi::GArray) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    pub(super) fn decode_gbytearray(
        &self,
        stashed_value: &ffi::StashedValue,
    ) -> anyhow::Result<value::Value> {
        let Some(ptr) = stashed_value.as_non_null_ptr("GByteArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let byte_array = ptr as *mut glib::ffi::GByteArray;
        let storage_owns = matches!(stashed_value, ffi::StashedValue::Stashed(_));
        let adopted: Option<glib::ByteArray> = (self.ownership.is_full() && !storage_owns)
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let data = unsafe { (*byte_array).data };
        let len = unsafe { (*byte_array).len as usize };

        let values: Vec<value::Value> = if data.is_null() || len == 0 {
            vec![]
        } else if let Some(owned) = &adopted {
            owned
                .iter()
                .map(|&b| value::Value::Number(f64::from(b)))
                .collect()
        } else {
            unsafe { std::slice::from_raw_parts(data, len) }
                .iter()
                .map(|&b| value::Value::Number(b as f64))
                .collect()
        };

        drop(adopted);
        Ok(value::Value::Array(values))
    }
}
