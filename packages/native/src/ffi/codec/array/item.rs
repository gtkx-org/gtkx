use std::ffi::c_void;

use crate::ffi::codec::{BigIntCodec, Codec, FloatCodec, IntegerCodec};
use crate::value::ViewKind;

#[derive(Debug, Clone, Copy)]
pub(super) enum ItemCodec {
    Integer(IntegerCodec),
    EnumFlags(IntegerCodec),
    BigInt(BigIntCodec),
    Float(FloatCodec),
    Boolean,
    Pointer,
    String,
}

impl ItemCodec {
    pub(super) fn from_codec(item_codec: &Codec) -> Option<Self> {
        if item_codec.is_handle_backed() {
            return Some(Self::Pointer);
        }
        Some(match item_codec {
            Codec::Integer(kind) => Self::Integer(*kind),
            Codec::EnumFlags(enum_flags) => Self::EnumFlags(enum_flags.storage),
            Codec::BigInt(kind) => Self::BigInt(*kind),
            Codec::Float(kind) => Self::Float(*kind),
            Codec::Boolean(_) => Self::Boolean,
            Codec::String(_) => Self::String,
            Codec::Object(_) | Codec::Boxed(_) | Codec::Struct(_) | Codec::Fundamental(_) => {
                unreachable!("handle-backed codecs are classified as pointers above")
            }
            Codec::Void(_)
            | Codec::Array(_)
            | Codec::Buffer(_)
            | Codec::HashTable(_)
            | Codec::Callback(_)
            | Codec::Ref(_)
            | Codec::Unichar(_) => return None,
        })
    }

    pub(super) fn accepts_buffer_view(self, view_kind: ViewKind) -> bool {
        match self {
            Self::Integer(kind) | Self::EnumFlags(kind) => matches!(
                (kind, view_kind),
                (IntegerCodec::I8, ViewKind::Int8)
                    | (IntegerCodec::U8, ViewKind::Uint8 | ViewKind::Uint8Clamped)
                    | (IntegerCodec::I16, ViewKind::Int16)
                    | (IntegerCodec::U16, ViewKind::Uint16)
                    | (IntegerCodec::I32, ViewKind::Int32)
                    | (IntegerCodec::U32, ViewKind::Uint32)
                    | (IntegerCodec::I64, ViewKind::BigInt64)
                    | (IntegerCodec::U64, ViewKind::BigUint64)
            ),
            Self::Float(FloatCodec::F32) => view_kind == ViewKind::Float32,
            Self::Float(FloatCodec::F64) => view_kind == ViewKind::Float64,
            Self::BigInt(kind) => matches!(
                (kind, view_kind),
                (BigIntCodec::I64, ViewKind::BigInt64) | (BigIntCodec::U64, ViewKind::BigUint64)
            ),
            Self::Boolean | Self::Pointer | Self::String => false,
        }
    }

    pub(super) fn element_size(self) -> usize {
        match self {
            Self::Integer(kind) | Self::EnumFlags(kind) => kind.byte_size(),
            Self::BigInt(kind) => kind.byte_size(),
            Self::Float(FloatCodec::F32) => size_of::<f32>(),
            Self::Float(FloatCodec::F64) => size_of::<f64>(),
            Self::Boolean => size_of::<i32>(),
            Self::Pointer | Self::String => size_of::<*mut c_void>(),
        }
    }
}
