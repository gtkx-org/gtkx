use std::cell::Cell;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, BoxedCodec, BufferCodec, CallbackCodec,
    CallbackScope, Codec, EnumFlagsCodec, EnumFlagsKind, FloatCodec, FundamentalCodec,
    HashTableCodec, IntegerCodec, ObjectCodec, Ownership, RefCodec, StringCodec, StructCodec,
    UnicharCodec, VoidCodec,
};

const MAX_DESCRIPTOR_DEPTH: u32 = 32;

#[derive(Debug)]
pub struct NestedDescriptor(pub Box<Descriptor>);

#[derive(Debug)]
pub struct Descriptors(pub Vec<Descriptor>);

struct DepthGuard;

thread_local! {
    static DESCRIPTOR_DEPTH: Cell<u32> = const { Cell::new(0) };
}

impl DepthGuard {
    fn enter() -> Result<Self> {
        let depth = DESCRIPTOR_DEPTH.get();
        if depth >= MAX_DESCRIPTOR_DEPTH {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Descriptor nesting exceeds the maximum depth of {MAX_DESCRIPTOR_DEPTH}"),
            ));
        }
        DESCRIPTOR_DEPTH.set(depth + 1);
        Ok(Self)
    }
}

impl Drop for DepthGuard {
    fn drop(&mut self) {
        DESCRIPTOR_DEPTH.set(DESCRIPTOR_DEPTH.get().saturating_sub(1));
    }
}

impl FromNapiValue for NestedDescriptor {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> Result<Self> {
        let _guard = DepthGuard::enter()?;

        Ok(Self(Box::new(unsafe {
            Descriptor::from_napi_value(env, napi_val)?
        })))
    }
}

impl FromNapiValue for Descriptors {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> Result<Self> {
        let _guard = DepthGuard::enter()?;

        Ok(Self(unsafe {
            Vec::<Descriptor>::from_napi_value(env, napi_val)?
        }))
    }
}

fn string_length(length: Option<i64>) -> Result<Option<usize>> {
    let Some(length) = length else {
        return Ok(None);
    };

    usize::try_from(length).map(Some).map_err(|_| {
        Error::new(
            Status::InvalidArg,
            format!("A string length must not be negative, got {length}"),
        )
    })
}

/// Describes how a single native value (a function argument, a return value, or a struct field)
/// is marshalled between JavaScript and C. The `kind` field selects the variant.
#[napi(
    discriminant = "kind",
    discriminant_case = "camelCase",
    object_to_js = false
)]
#[derive(Debug)]
pub enum Descriptor {
    Int8,
    Uint8,
    Int16,
    Uint16,
    Int32,
    Uint32,
    Int64,
    Uint64,
    Bigint64,
    Biguint64,
    Float32,
    Float64,
    Enum {
        shared_library: String,
        get_type_fn_name: String,
        is_signed: bool,
    },
    Flags {
        shared_library: String,
        get_type_fn_name: String,
        is_signed: bool,
    },
    Boolean,
    String {
        ownership: Ownership,
        length: Option<i64>,
    },
    Object {
        ownership: Ownership,
    },
    Unichar,
    Void,
    Buffer,
    Boxed {
        ownership: Ownership,
        type_name: String,
        shared_library: Option<String>,
        get_type_fn_name: Option<String>,
        free_fn_name: Option<String>,
        is_caller_allocated: Option<bool>,
        size: Option<u32>,
        is_inline: Option<bool>,
    },
    Struct {
        ownership: Ownership,
        size: Option<u32>,
        is_caller_allocated: Option<bool>,
        is_inline: Option<bool>,
    },
    Fundamental {
        ownership: Ownership,
        shared_library: String,
        ref_fn_name: String,
        unref_fn_name: String,
        type_name: Option<String>,
        is_inline: Option<bool>,
    },
    Array {
        #[napi(ts_type = "Descriptor")]
        item_descriptor: NestedDescriptor,
        array_kind: ArrayKind,
        ownership: Ownership,
        size_param_index: Option<u32>,
        fixed_size: Option<u32>,
        element_size: Option<u32>,
    },
    Hashtable {
        #[napi(ts_type = "Descriptor")]
        key_descriptor: NestedDescriptor,
        #[napi(ts_type = "Descriptor")]
        value_descriptor: NestedDescriptor,
        ownership: Ownership,
    },
    Callback {
        #[napi(ts_type = "Array<Descriptor>")]
        arg_descriptors: Descriptors,
        #[napi(ts_type = "Descriptor")]
        return_descriptor: NestedDescriptor,
        has_destroy: Option<bool>,
        user_data_index: Option<u32>,
        scope: Option<CallbackScope>,
    },
    Ref {
        #[napi(ts_type = "Descriptor")]
        inner_descriptor: NestedDescriptor,
        inout: Option<bool>,
    },
}

impl NestedDescriptor {
    fn into_codec(self) -> Result<Box<Codec>> {
        Ok(Box::new((*self.0).into_codec()?))
    }
}

impl Descriptor {
    pub fn into_codec(self) -> Result<Codec> {
        Ok(match self {
            Self::Int8 => Codec::Integer(IntegerCodec::I8),
            Self::Uint8 => Codec::Integer(IntegerCodec::U8),
            Self::Int16 => Codec::Integer(IntegerCodec::I16),
            Self::Uint16 => Codec::Integer(IntegerCodec::U16),
            Self::Int32 => Codec::Integer(IntegerCodec::I32),
            Self::Uint32 => Codec::Integer(IntegerCodec::U32),
            Self::Int64 => Codec::Integer(IntegerCodec::I64),
            Self::Uint64 => Codec::Integer(IntegerCodec::U64),
            Self::Bigint64 => Codec::BigInt(BigIntCodec::I64),
            Self::Biguint64 => Codec::BigInt(BigIntCodec::U64),
            Self::Float32 => Codec::Float(FloatCodec::F32),
            Self::Float64 => Codec::Float(FloatCodec::F64),
            Self::Boolean => Codec::Boolean(BooleanCodec),
            Self::Unichar => Codec::Unichar(UnicharCodec),
            Self::Void => Codec::Void(VoidCodec),
            Self::Buffer => Codec::Buffer(BufferCodec),
            Self::Enum {
                shared_library,
                get_type_fn_name,
                is_signed,
            } => Self::enum_flags(
                EnumFlagsKind::Enum,
                shared_library,
                get_type_fn_name,
                is_signed,
            ),
            Self::Flags {
                shared_library,
                get_type_fn_name,
                is_signed,
            } => Self::enum_flags(
                EnumFlagsKind::Flags,
                shared_library,
                get_type_fn_name,
                is_signed,
            ),
            Self::String { ownership, length } => Codec::String(StringCodec {
                ownership,
                length: string_length(length)?,
            }),
            Self::Object { ownership } => Codec::Object(ObjectCodec { ownership }),
            Self::Boxed {
                ownership,
                type_name,
                shared_library,
                get_type_fn_name,
                free_fn_name,
                is_caller_allocated,
                size,
                is_inline,
            } => Codec::Boxed(BoxedCodec {
                ownership,
                type_name,
                shared_library,
                get_type_fn_name,
                free_fn_name,
                caller_allocated: is_caller_allocated.unwrap_or(false),
                size: size.map(|n| n as usize),
                inline: is_inline.unwrap_or(false),
            }),
            Self::Struct {
                ownership,
                size,
                is_caller_allocated,
                is_inline,
            } => Codec::Struct(StructCodec {
                ownership,
                size: size.map(|n| n as usize),
                caller_allocated: is_caller_allocated.unwrap_or(false),
                inline: is_inline.unwrap_or(false),
            }),
            Self::Fundamental {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
                type_name: _,
                is_inline,
            } => Codec::Fundamental(FundamentalCodec {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
                inline: is_inline.unwrap_or(false),
            }),
            nested => nested.into_nested_codec()?,
        })
    }

    fn into_nested_codec(self) -> Result<Codec> {
        Ok(match self {
            Self::Array {
                item_descriptor,
                array_kind,
                ownership,
                size_param_index,
                fixed_size,
                element_size,
            } => Codec::Array(
                ArrayCodec::new(
                    item_descriptor.into_codec()?,
                    array_kind,
                    ownership,
                    size_param_index,
                    fixed_size,
                    element_size.map(|n| n as usize),
                )
                .map_err(|error| Error::from_reason(error.to_string()))?,
            ),
            Self::Hashtable {
                key_descriptor,
                value_descriptor,
                ownership,
            } => Codec::HashTable(HashTableCodec {
                key_codec: key_descriptor.into_codec()?,
                value_codec: value_descriptor.into_codec()?,
                ownership,
            }),
            Self::Callback {
                arg_descriptors,
                return_descriptor,
                has_destroy,
                user_data_index,
                scope,
            } => {
                let has_destroy = has_destroy.unwrap_or(false);
                let user_data_index = user_data_index.map(|n| n as usize);
                Codec::Callback(CallbackCodec {
                    arg_codecs: arg_descriptors
                        .0
                        .into_iter()
                        .map(Self::into_codec)
                        .collect::<Result<Vec<_>>>()?,
                    return_codec: return_descriptor.into_codec()?,
                    has_destroy,
                    user_data_index,
                    scope: Self::callback_scope(scope, has_destroy, user_data_index),
                })
            }
            Self::Ref {
                inner_descriptor,
                inout,
            } => Codec::Ref(RefCodec::new(
                *inner_descriptor.into_codec()?,
                inout.unwrap_or(false),
            )?),
            _ => unreachable!("descriptors without nested descriptors are handled by into_codec"),
        })
    }

    fn enum_flags(
        kind: EnumFlagsKind,
        shared_library: String,
        get_type_fn_name: String,
        is_signed: bool,
    ) -> Codec {
        Codec::EnumFlags(EnumFlagsCodec {
            kind,
            shared_library,
            get_type_fn_name,
            storage: if is_signed {
                IntegerCodec::I32
            } else {
                IntegerCodec::U32
            },
        })
    }

    fn callback_scope(
        scope: Option<CallbackScope>,
        has_destroy: bool,
        user_data_index: Option<usize>,
    ) -> CallbackScope {
        if user_data_index.is_none() && !has_destroy {
            return CallbackScope::Forever;
        }
        match scope {
            Some(scope) => scope,
            None if has_destroy => CallbackScope::Notified,
            None => CallbackScope::Call,
        }
    }
}
