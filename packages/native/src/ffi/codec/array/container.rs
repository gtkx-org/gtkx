use anyhow::bail;
use enum_dispatch::enum_dispatch;
use napi_derive::napi;

use super::super::object::g_object_unref_wrapper;
use super::super::prelude::*;
use super::ArrayCodec;
use super::byte_array::GByteArrayCodec;
use super::cursor::CursorArrayCodec;
use super::fixed::FixedArrayCodec;
use super::garray::GArrayCodec;
use super::list::ListArrayCodec;
use super::null_terminated::{NullTerminatedArrayCodec, NullTerminatedArrayEncoder};
use super::ptr_array::GPtrArrayCodec;
use super::sized::SizedArrayCodec;
use crate::ffi::codec::Codec;
use crate::value::TypedView;

/// Container layout used to marshal an array: a plain C `array`, a `glist`, `gslist`, `gptrarray`,
/// `garray`, `gbytearray`, a `sized` buffer, a `fixed`-length buffer, or a `cursor` pointing into
/// the buffer another argument supplied.
#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArrayKind {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    GByteArray,
    Sized,
    Fixed,
    Cursor,
}

/// Where an array container reads its extent from, as the descriptor declared it.
#[derive(Debug, Clone, Copy)]
pub struct ArrayBounds {
    pub base_param_index: Option<u32>,
    pub size_param_index: Option<u32>,
    pub fixed_size: Option<u32>,
}

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ElementOwnership {
    #[default]
    Separate,
    Container,
}

#[derive(Debug, Clone, Copy)]
pub(super) enum ArrayRead {
    Declared(Ownership),
    Container(Ownership),
    Borrowed,
}

impl ArrayRead {
    pub(super) fn transfer(self) -> Ownership {
        match self {
            Self::Declared(transfer) | Self::Container(transfer) => transfer,
            Self::Borrowed => Ownership::Borrowed,
        }
    }

    pub(super) fn borrows_items(self) -> bool {
        matches!(self, Self::Borrowed | Self::Container(_))
    }
}

#[enum_dispatch]
pub(super) trait ArrayContainer {
    fn encode(
        &self,
        codec: &ArrayCodec,
        env: Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        codec.encode_items(env, &NullTerminatedArrayEncoder, array)
    }

    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        codec.decode_null_terminated(env, self.name(), stash, read)
    }

    fn decode_with_context<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        _ffi_args: &[ffi::Stash],
        _arg_codecs: &[Codec],
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode(codec, env, stash, read)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Rejected
    }

    fn encode_buffer_view(
        &self,
        codec: &ArrayCodec,
        view: &TypedView,
        encoding: ViewEncoding,
    ) -> anyhow::Result<ffi::Stash> {
        match self.buffer_view_support() {
            BufferViewSupport::Contiguous(expected_length) => {
                codec.buffer_view_stash(view, expected_length, encoding)
            }
            BufferViewSupport::Rejected => {
                anyhow::ensure!(
                    codec.ownership.is_borrowed(),
                    "A transfer-full array argument cannot be encoded from an ArrayBufferView: the callee would free the JavaScript buffer"
                );
                bail!(
                    "{} arrays cannot be encoded from an ArrayBufferView; only contiguous arrays support zero-copy passthrough",
                    self.name()
                )
            }
        }
    }

    fn name(&self) -> &'static str;
}

pub(super) enum BufferViewSupport {
    Rejected,
    Contiguous(Option<usize>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ViewEncoding {
    Passthrough,
    Copy,
}

#[enum_dispatch(ArrayContainer)]
#[derive(Debug, Clone)]
pub(crate) enum ArrayContainerCodec {
    NullTerminated(NullTerminatedArrayCodec),
    Sized(SizedArrayCodec),
    Fixed(FixedArrayCodec),
    Cursor(CursorArrayCodec),
    List(ListArrayCodec),
    PtrArray(GPtrArrayCodec),
    GArray(GArrayCodec),
    ByteArray(GByteArrayCodec),
}

fn required_index(index: Option<u32>, field: &str, kind: &str) -> anyhow::Result<u32> {
    index.ok_or_else(|| anyhow::anyhow!("A {kind} array requires a {field}"))
}

impl ArrayContainerCodec {
    pub(super) fn from_kind(kind: ArrayKind, bounds: ArrayBounds) -> anyhow::Result<Self> {
        Ok(match kind {
            ArrayKind::Array => Self::NullTerminated(NullTerminatedArrayCodec),
            ArrayKind::Sized => Self::Sized(SizedArrayCodec::new(required_index(
                bounds.size_param_index,
                "sizeParamIndex",
                "sized",
            )?)),
            ArrayKind::Fixed => Self::Fixed(FixedArrayCodec::new(required_index(
                bounds.fixed_size,
                "fixedSize",
                "fixed",
            )?)),
            ArrayKind::Cursor => Self::Cursor(CursorArrayCodec::new(
                required_index(bounds.base_param_index, "baseParamIndex", "cursor")?,
                required_index(bounds.size_param_index, "sizeParamIndex", "cursor")?,
            )),
            ArrayKind::GList => Self::List(ListArrayCodec::new(&ffi::GLIST_OPS)),
            ArrayKind::GSList => Self::List(ListArrayCodec::new(&ffi::GSLIST_OPS)),
            ArrayKind::GPtrArray => Self::PtrArray(GPtrArrayCodec),
            ArrayKind::GArray => Self::GArray(GArrayCodec),
            ArrayKind::GByteArray => Self::ByteArray(GByteArrayCodec),
        })
    }

    pub(super) fn release_kind(&self) -> ffi::ReleaseKind {
        match self {
            Self::List(list) => list.release_kind(),
            Self::PtrArray(_) => ffi::ReleaseKind::GPtrArrayUnref,
            Self::GArray(_) => ffi::ReleaseKind::GArrayUnref,
            Self::ByteArray(_) => ffi::ReleaseKind::GByteArrayUnref,
            Self::NullTerminated(_) | Self::Sized(_) | Self::Fixed(_) | Self::Cursor(_) => {
                ffi::ReleaseKind::GFree
            }
        }
    }

    pub(super) fn is_length_bounded(&self) -> bool {
        matches!(self, Self::Sized(_) | Self::Fixed(_) | Self::Cursor(_))
    }

    pub(super) fn fixed_extent(&self) -> Option<usize> {
        match self {
            Self::Fixed(fixed) => Some(fixed.extent()),
            _ => None,
        }
    }
}

pub(super) unsafe extern "C" fn free_element_slot(slot: *mut c_void) {
    unsafe { glib::ffi::g_free(*slot.cast::<*mut c_void>()) };
}

unsafe extern "C" fn unref_object_slot(slot: *mut c_void) {
    unsafe { g_object_unref_wrapper(*slot.cast::<*mut c_void>()) };
}

impl ArrayCodec {
    pub(super) fn container_destroy(
        &self,
        indirect: bool,
    ) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        if self.element_ownership == ElementOwnership::Separate {
            return Ok(None);
        }
        anyhow::ensure!(
            self.inline_element_size().is_none(),
            "Container-owned inline resources cannot be encoded"
        );
        match &*self.item_codec {
            Codec::Integer(_) | Codec::BigInt(_) | Codec::Float(_) => Ok(None),
            Codec::Bytes(_) | Codec::Object(_) => match self.item_codec.owned_release()? {
                Some(ffi::ReleaseKind::GFree) => Ok(Some(if indirect {
                    free_element_slot
                } else {
                    glib::ffi::g_free
                })),
                Some(ffi::ReleaseKind::ObjectUnref) => Ok(Some(if indirect {
                    unref_object_slot
                } else {
                    g_object_unref_wrapper
                })),
                _ => bail!("Container-owned item has no supported destructor"),
            },
            _ => bail!("Container-owned encoding requires string, Object or scalar items"),
        }
    }
}
