use super::super::prelude::*;
use super::container::ArrayContainer;
use super::item::ItemCodec;
use super::{ArrayCodec, ArrayKindEncoder, dup_strings_to_glib, transfer_items};
use crate::ffi::codec::Codec;
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
        env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        // Every slot of a GPtrArray holds one pointer, so an element the encoder would lay out
        // contiguously instead has no representation here.
        anyhow::ensure!(
            codec.inline_element_size().is_none()
                && !matches!(
                    ItemCodec::from_codec(&codec.item_codec),
                    Some(ItemCodec::Float(_))
                ),
            "A GPtrArray cannot carry {:?} elements: every slot holds one pointer",
            codec.item_codec
        );

        codec.encode_items(env, &GPtrArrayEncoder, array)
    }

    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr("GPtrArray")? else {
            return codec.decode_null(env);
        };

        let ptr_array = ptr.cast::<glib::ffi::GPtrArray>();
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let items = (0..len).map(move |i| unsafe { *pdata.add(i) });

        let is_full = transfer.is_full();
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

struct GPtrArrayEncoder;

impl GPtrArrayEncoder {
    fn build(
        ptrs: &[*mut c_void],
        element_free: glib::ffi::GDestroyNotify,
        ownership: Ownership,
        acquired: Vec<ffi::PendingTransfer>,
    ) -> anyhow::Result<ffi::Stash> {
        let ptr_array =
            unsafe { glib::ffi::g_ptr_array_new_full(element_count(ptrs.len())?, element_free) };
        for &ptr in ptrs {
            unsafe { glib::ffi::g_ptr_array_add(ptr_array, ptr) };
        }

        let should_free = ownership.is_borrowed();
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
}

impl ArrayKindEncoder for GPtrArrayEncoder {
    fn encode_strings(
        &self,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let dups = dup_strings_to_glib(array)?;

        // The callee frees the duplicates itself only when it takes both the container and its
        // elements. Everywhere else they stay this side's allocations, and the array's own free
        // function releases them whichever side drops the last reference.
        if dup_items && ownership.is_full() {
            let acquired = dups
                .iter()
                .map(|&dup| ffi::PendingTransfer::new(dup, ffi::ReleaseKind::GFree))
                .collect();

            return Self::build(&dups, None, ownership, acquired);
        }

        Self::build(&dups, Some(glib::ffi::g_free), ownership, Vec::new())
    }

    fn encode_handles(
        &self,
        handles: Vec<crate::handle::Handle>,
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let (ptrs, acquired) = transfer_items(&handles, item_codec, "GPtrArray")?;

        Self::build(&ptrs, None, ownership, acquired)
    }

    fn holds_pointer_slots(&self) -> bool {
        true
    }

    fn encode_pointer_words(
        &self,
        words: Vec<*mut c_void>,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        Self::build(&words, None, ownership, Vec::new())
    }
}
