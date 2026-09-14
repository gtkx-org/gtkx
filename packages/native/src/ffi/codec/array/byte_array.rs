use anyhow::bail;
use glib::translate::{IntoGlibPtr, ToGlibPtr};

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::{ArrayContainer, BufferViewSupport, ViewEncoding};
use crate::ffi::{StashData, StashStorage};
use crate::value::TypedView;

#[derive(Debug, Clone)]
pub(crate) struct GByteArrayCodec;

impl ArrayContainer for GByteArrayCodec {
    fn encode(
        &self,
        _codec: &ArrayCodec,
        _env: Env,
        _array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        bail!("Expected a byte view for GByteArray")
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(None)
    }

    fn encode_buffer_view(
        &self,
        codec: &ArrayCodec,
        view: &TypedView,
        _encoding: ViewEncoding,
    ) -> anyhow::Result<ffi::Stash> {
        let item = codec.item_codec("GByteArray")?;

        anyhow::ensure!(
            item.accepts_buffer_view(view.kind()),
            "A {} cannot supply GByteArray bytes",
            view.kind()
        );

        Ok(Self::stash_bytes(codec, &view.to_vec::<u8>()))
    }

    fn decode<'e>(
        &self,
        _codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr("GByteArray")? else {
            return Ok(value::js_null(env)?);
        };

        let byte_array = ptr.cast::<glib::ffi::GByteArray>();
        let storage_owns = matches!(stash, ffi::Stash::Storage(_));
        let adopted: Option<glib::ByteArray> = (transfer.is_full() && !storage_owns)
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let data = unsafe { (*byte_array).data };
        let len = unsafe { (*byte_array).len as usize };

        let bytes = unsafe { value::js_byte_array(env, data, len) };
        drop(adopted);

        Ok(bytes?)
    }

    fn name(&self) -> &'static str {
        "GByteArray"
    }
}

impl GByteArrayCodec {
    fn stash_bytes(codec: &ArrayCodec, bytes: &[u8]) -> ffi::Stash {
        let byte_array = glib::ByteArray::from(bytes);
        let should_free = codec.ownership.is_borrowed();
        let (ptr, owned) = if should_free {
            let ptr = ToGlibPtr::<*mut glib::ffi::GByteArray>::to_glib_none(&byte_array).0;
            (ptr, Some(byte_array))
        } else {
            let ptr = IntoGlibPtr::<*mut glib::ffi::GByteArray>::into_glib_ptr(byte_array);
            (ptr, None)
        };

        let storage = StashStorage::new(ptr.cast::<c_void>(), StashData::GByteArray(owned));

        finalize_container_stash(
            storage,
            should_free,
            Vec::new(),
            ffi::ReleaseKind::GByteArrayUnref,
        )
    }
}
