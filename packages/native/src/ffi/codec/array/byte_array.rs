use anyhow::bail;
use glib::translate::{IntoGlibPtr, ToGlibPtr};

use super::super::prelude::*;
use super::container::ArrayContainer;
use super::{ArrayCodec, build_js_array};
use crate::ffi::codec::IntegerCodec;
use crate::ffi::{StashData, StashStorage};

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn checked_byte(n: f64) -> anyhow::Result<u8> {
    IntegerCodec::U8.check_range(n)?;

    Ok(n as u8)
}

#[derive(Debug, Clone)]
pub(crate) struct GByteArrayCodec;

impl ArrayContainer for GByteArrayCodec {
    fn encode(
        &self,
        codec: &ArrayCodec,
        _env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        let bytes: Vec<u8> = array
            .iter()
            .enumerate()
            .map(|(i, &v)| match v.get_type()? {
                ValueType::Number => {
                    let n = value::read_napi::<f64>(v)?;

                    checked_byte(n).map_err(|e| anyhow::anyhow!("GByteArray element {i}: {e}"))
                }
                other => bail!("Expected a Number for GByteArray element, got {other:?}"),
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

        let storage = StashStorage::new(ptr.cast::<c_void>(), StashData::GByteArray(owned));
        Ok(finalize_container_stash(
            storage,
            should_free,
            Vec::new(),
            ffi::ReleaseKind::GByteArrayUnref,
        ))
    }

    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr("GByteArray")? else {
            return build_js_array(env, Vec::new());
        };

        let byte_array = ptr.cast::<glib::ffi::GByteArray>();
        let storage_owns = matches!(stash, ffi::Stash::Storage(_));
        let adopted: Option<glib::ByteArray> = (codec.ownership.is_full() && !storage_owns)
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let data = unsafe { (*byte_array).data };
        let len = unsafe { (*byte_array).len as usize };

        let bytes: Vec<u8> = if data.is_null() || len == 0 {
            Vec::new()
        } else if let Some(owned) = &adopted {
            owned.to_vec()
        } else {
            unsafe { std::slice::from_raw_parts(data, len) }.to_vec()
        };

        drop(adopted);

        let values = bytes
            .into_iter()
            .map(|b| Ok(f64::from(b).into_unknown(env)?))
            .collect::<anyhow::Result<Vec<_>>>()?;
        build_js_array(env, values)
    }

    fn name(&self) -> &'static str {
        "GByteArray"
    }
}
