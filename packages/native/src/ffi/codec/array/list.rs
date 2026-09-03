use std::ffi::CString;

use super::super::prelude::*;
use super::container::ArrayContainer;
use super::{ArrayCodec, ArrayKindEncoder, dup_strings_to_glib, transfer_items};
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub(crate) struct ListArrayCodec {
    ops: &'static ffi::ListOps,
}

impl ListArrayCodec {
    pub(super) fn new(ops: &'static ffi::ListOps) -> Self {
        Self { ops }
    }
}

impl ArrayContainer for ListArrayCodec {
    fn encode(
        &self,
        codec: &ArrayCodec,
        env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        codec.encode_items(env, &ListEncoder(self.ops), array)
    }

    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let ops = self.ops;
        let Some(ptr) = stash.as_non_null_ptr(ops.label)? else {
            return codec.decode_null(env);
        };

        let mut current = ptr;
        let nodes = std::iter::from_fn(move || {
            if current.is_null() {
                return None;
            }
            let node = unsafe { (ops.node)(current) };
            current = node.next;
            Some(node.data)
        });

        let is_full = transfer.is_full();
        codec.decode_ptr_iter(env, nodes, move || {
            if is_full {
                unsafe { (ops.free)(ptr) };
            }
        })
    }

    fn name(&self) -> &'static str {
        self.ops.label
    }
}

fn string_list_parts(
    array: &[Unknown<'_>],
    dup_items: bool,
) -> anyhow::Result<(Vec<CString>, Vec<*mut c_void>)> {
    if dup_items {
        Ok((Vec::new(), dup_strings_to_glib(array)?))
    } else {
        let cstrings = ArrayCodec::extract_strings(array)?;
        let ptrs = cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        Ok((cstrings, ptrs))
    }
}

struct ListEncoder(&'static ffi::ListOps);

impl ListEncoder {
    fn finalize_list(
        &self,
        list: *mut c_void,
        should_free: bool,
        payload: ffi::ListPayload,
        acquired: Vec<ffi::PendingTransfer>,
    ) -> ffi::Stash {
        let storage = StashStorage::new(
            list,
            StashData::List(ffi::ListData {
                ops: self.0,
                ptr: list,
                should_free,
                payload,
            }),
        );
        finalize_container_stash(storage, should_free, acquired, self.0.pending)
    }
}

impl ArrayKindEncoder for ListEncoder {
    fn encode_strings(
        &self,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let should_free = ownership.is_borrowed();
        let (strings, ptrs) = string_list_parts(array, dup_items)?;
        let list = ffi::build_list(self.0, &ptrs);
        let acquired: Vec<ffi::PendingTransfer> = if !should_free && dup_items {
            ptrs.iter()
                .map(|p| ffi::PendingTransfer::new(*p, ffi::ReleaseKind::GFree))
                .collect()
        } else {
            Vec::new()
        };
        let payload = ffi::ListPayload::Strings {
            strings,
            items_duped: dup_items,
        };
        Ok(self.finalize_list(list, should_free, payload, acquired))
    }

    fn encode_handles(
        &self,
        handles: Vec<crate::handle::Handle>,
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let should_free = ownership.is_borrowed();
        let (ptrs, acquired) = transfer_items(&handles, item_codec, self.0.label)?;
        let list = ffi::build_list(self.0, &ptrs);
        let payload = ffi::ListPayload::Handles(handles);
        Ok(self.finalize_list(list, should_free, payload, acquired))
    }

    fn holds_pointer_slots(&self) -> bool {
        true
    }

    fn encode_pointer_words(
        &self,
        words: Vec<*mut c_void>,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        let list = ffi::build_list(self.0, &words);

        Ok(self.finalize_list(
            list,
            ownership.is_borrowed(),
            ffi::ListPayload::Handles(Vec::new()),
            Vec::new(),
        ))
    }
}
