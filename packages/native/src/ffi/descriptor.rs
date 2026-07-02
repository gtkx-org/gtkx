use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, BoxedCodec, BufferCodec, CallbackCodec,
    CallbackScope, Codec, EnumFlagsCodec, EnumFlagsKind, FloatCodec, FundamentalCodec,
    HashTableCodec, IntegerCodec, ObjectCodec, Ownership, RefCodec, StringCodec, StructCodec,
    UnicharCodec, VoidCodec,
};

#[derive(Debug)]
pub struct NestedDescriptor(pub Box<Descriptor>);

type Descriptors = Vec<Descriptor>;

impl FromNapiValue for NestedDescriptor {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> napi::Result<Self> {
        Ok(Self(Box::new(unsafe {
            Descriptor::from_napi_value(env, napi_val)?
        })))
    }
}

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
        signed: bool,
    },
    Flags {
        shared_library: String,
        get_type_fn_name: String,
        signed: bool,
    },
    Boolean,
    String {
        ownership: Ownership,
        length: Option<u32>,
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
        caller_allocated: Option<bool>,
        size: Option<u32>,
    },
    Struct {
        ownership: Ownership,
        size: Option<u32>,
        caller_allocated: Option<bool>,
    },
    Fundamental {
        ownership: Ownership,
        shared_library: String,
        ref_fn_name: String,
        unref_fn_name: String,
        type_name: Option<String>,
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
    fn into_codec(self) -> napi::Result<Box<Codec>> {
        Ok(Box::new((*self.0).into_codec()?))
    }
}

impl Descriptor {
    pub fn into_codec(self) -> napi::Result<Codec> {
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
                signed,
            } => Self::enum_flags(
                EnumFlagsKind::Enum,
                shared_library,
                get_type_fn_name,
                signed,
            ),
            Self::Flags {
                shared_library,
                get_type_fn_name,
                signed,
            } => Self::enum_flags(
                EnumFlagsKind::Flags,
                shared_library,
                get_type_fn_name,
                signed,
            ),
            Self::String { ownership, length } => Codec::String(StringCodec {
                ownership,
                length: length.map(|n| n as usize),
            }),
            Self::Object { ownership } => Codec::Object(ObjectCodec { ownership }),
            Self::Boxed {
                ownership,
                type_name,
                shared_library,
                get_type_fn_name,
                free_fn_name,
                caller_allocated,
                size: _,
            } => Codec::Boxed(BoxedCodec {
                ownership,
                type_name,
                shared_library,
                get_type_fn_name,
                free_fn_name,
                caller_allocated: caller_allocated.unwrap_or(false),
            }),
            Self::Struct {
                ownership,
                size,
                caller_allocated,
            } => Codec::Struct(StructCodec {
                ownership,
                size: size.map(|n| n as usize),
                caller_allocated: caller_allocated.unwrap_or(false),
            }),
            Self::Fundamental {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
                type_name: _,
            } => Codec::Fundamental(FundamentalCodec {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
            }),
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
                Codec::Callback(CallbackCodec {
                    arg_codecs: arg_descriptors
                        .into_iter()
                        .map(Self::into_codec)
                        .collect::<napi::Result<Vec<_>>>()?,
                    return_codec: return_descriptor.into_codec()?,
                    has_destroy,
                    user_data_index: user_data_index.map(|n| n as usize),
                    scope: Self::callback_scope(scope, has_destroy),
                })
            }
            Self::Ref {
                inner_descriptor,
                inout: _,
            } => Codec::Ref(RefCodec::new(*inner_descriptor.into_codec()?)?),
        })
    }

    fn enum_flags(
        kind: EnumFlagsKind,
        shared_library: String,
        get_type_fn_name: String,
        signed: bool,
    ) -> Codec {
        Codec::EnumFlags(EnumFlagsCodec {
            kind,
            shared_library,
            get_type_fn_name,
            storage: if signed {
                IntegerCodec::I32
            } else {
                IntegerCodec::U32
            },
        })
    }

    fn callback_scope(scope: Option<CallbackScope>, has_destroy: bool) -> CallbackScope {
        match scope {
            Some(scope) => scope,
            None if has_destroy => CallbackScope::Notified,
            None => CallbackScope::Call,
        }
    }
}
