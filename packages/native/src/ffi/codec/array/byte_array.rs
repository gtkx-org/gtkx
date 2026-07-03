use anyhow::bail;
use glib::translate::{IntoGlibPtr, ToGlibPtr};

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::ArrayContainer;
use crate::ffi::codec::IntegerCodec;
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub(crate) struct GByteArrayCodec;

impl ArrayContainer for GByteArrayCodec {
    fn encode(&self, codec: &ArrayCodec, array: &[value::Value]) -> anyhow::Result<ffi::Stash> {
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

        let byte_array = glib::ByteArray::from(bytes.as_slice());
        let should_free = codec.ownership.is_borrowed();
        let (ptr, owned) = if should_free {
            let ptr = ToGlibPtr::<*mut glib::ffi::GByteArray>::to_glib_none(&byte_array).0;
            (ptr, Some(byte_array))
        } else {
            let ptr = IntoGlibPtr::<*mut glib::ffi::GByteArray>::into_glib_ptr(byte_array);
            (ptr, None)
        };

        let storage = StashStorage::new(ptr as *mut c_void, StashData::GByteArray(owned));
        Ok(finalize_container_stash(
            storage,
            should_free,
            Vec::new(),
            ffi::ReleaseKind::GByteArrayUnref,
        ))
    }

    fn decode(&self, codec: &ArrayCodec, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        let Some(ptr) = stash.as_non_null_ptr("GByteArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let byte_array = ptr as *mut glib::ffi::GByteArray;
        let storage_owns = matches!(stash, ffi::Stash::Storage(_));
        let adopted: Option<glib::ByteArray> = (codec.ownership.is_full() && !storage_owns)
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

    fn name(&self) -> &'static str {
        "GByteArray"
    }
}
