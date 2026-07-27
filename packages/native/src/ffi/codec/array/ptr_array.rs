use super::super::prelude::*;
use super::container::ArrayContainer;
use super::{ArrayCodec, transfer_items};
use crate::ffi::{StashData, StashStorage};

fn element_count(len: usize) -> anyhow::Result<u32> {
    u32::try_from(len)
        .map_err(|_| anyhow::anyhow!("GPtrArray length {len} does not fit in a guint"))
}

#[derive(Debug, Clone)]
pub(crate) struct GPtrArrayCodec;

impl ArrayContainer for GPtrArrayCodec {
    fn encode(
        &self,
        codec: &ArrayCodec,
        _env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        let handles = ArrayCodec::extract_handles(array)?;
        let (ptrs, acquired) = transfer_items(&handles, &codec.item_codec, "GPtrArray")?;
        let ptr_array = unsafe { glib::ffi::g_ptr_array_sized_new(element_count(ptrs.len())?) };
        for ptr in ptrs {
            unsafe { glib::ffi::g_ptr_array_add(ptr_array, ptr) };
        }

        let should_free = codec.ownership.is_borrowed();
        let storage = StashStorage::new(
            ptr_array.cast::<c_void>(),
            StashData::GPtrArray(ffi::GPtrArrayData {
                ptr: ptr_array,
                should_free,
            }),
        );

        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            ffi::ReleaseKind::GPtrArrayUnref,
        ))
    }

    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr("GPtrArray")? else {
            return super::build_js_array(env, Vec::new());
        };

        let ptr_array = ptr.cast::<glib::ffi::GPtrArray>();
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let items = (0..len).map(move |i| unsafe { *pdata.add(i) });

        let is_full = codec.ownership.is_full();
        codec.decode_ptr_iter(env, items, move || {
            if is_full {
                unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
            }
        })
    }

    fn name(&self) -> &'static str {
        "GPtrArray"
    }
}
