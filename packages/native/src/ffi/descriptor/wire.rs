use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::callback::CallbackScope;
use super::{
    ArrayDescriptor, ArrayKind, BigIntKind, BooleanDescriptor, BoxedDescriptor, BufferDescriptor,
    CallbackDescriptor, Codec, EnumFlagsDescriptor, EnumFlagsKind, FloatKind,
    FundamentalDescriptor, HashTableDescriptor, IntegerKind, ObjectDescriptor, Ownership,
    RefDescriptor, StringDescriptor, StructDescriptor, UnicharDescriptor, VoidDescriptor,
};

#[derive(Debug)]
pub struct DescriptorRef(pub Box<Descriptor>);

type Descriptors = Vec<Descriptor>;

impl FromNapiValue for DescriptorRef {
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
        get_type_fn: String,
        signed: bool,
    },
    Flags {
        shared_library: String,
        get_type_fn: String,
        signed: bool,
    },
    Boolean,
    String {
        ownership: String,
        length: Option<u32>,
    },
    Object {
        ownership: String,
    },
    Unichar,
    Void,
    Buffer,
    Boxed {
        ownership: String,
        type_name: String,
        shared_library: Option<String>,
        get_type_fn: Option<String>,
        free_fn: Option<String>,
        caller_allocated: Option<bool>,
    },
    Struct {
        ownership: String,
        size: Option<u32>,
        caller_allocated: Option<bool>,
    },
    Fundamental {
        ownership: String,
        shared_library: String,
        ref_fn: String,
        unref_fn: String,
        type_name: Option<String>,
    },
    Array {
        #[napi(ts_type = "Descriptor")]
        item_descriptor: DescriptorRef,
        array_kind: String,
        ownership: String,
        element_size: Option<u32>,
        size_param_index: Option<u32>,
        fixed_size: Option<u32>,
    },
    Hashtable {
        #[napi(ts_type = "Descriptor")]
        key_descriptor: DescriptorRef,
        #[napi(ts_type = "Descriptor")]
        value_descriptor: DescriptorRef,
        ownership: String,
    },
    Callback {
        #[napi(ts_type = "Array<Descriptor>")]
        arg_descriptors: Descriptors,
        #[napi(ts_type = "Descriptor")]
        return_descriptor: DescriptorRef,
        has_destroy: Option<bool>,
        user_data_index: Option<u32>,
        scope: Option<String>,
    },
    Ref {
        #[napi(ts_type = "Descriptor")]
        inner_descriptor: DescriptorRef,
        inout: Option<bool>,
    },
}

fn invalid_arg(message: String) -> napi::Error {
    napi::Error::new(napi::Status::InvalidArg, message)
}

fn parse_ownership(ownership: &str) -> napi::Result<Ownership> {
    ownership.parse().map_err(invalid_arg)
}

impl DescriptorRef {
    fn into_codec(self) -> napi::Result<Box<Codec>> {
        Ok(Box::new((*self.0).into_codec()?))
    }
}

impl Descriptor {
    pub fn into_codec(self) -> napi::Result<Codec> {
        Ok(match self {
            Self::Int8 => Codec::Integer(IntegerKind::I8),
            Self::Uint8 => Codec::Integer(IntegerKind::U8),
            Self::Int16 => Codec::Integer(IntegerKind::I16),
            Self::Uint16 => Codec::Integer(IntegerKind::U16),
            Self::Int32 => Codec::Integer(IntegerKind::I32),
            Self::Uint32 => Codec::Integer(IntegerKind::U32),
            Self::Int64 => Codec::Integer(IntegerKind::I64),
            Self::Uint64 => Codec::Integer(IntegerKind::U64),
            Self::Bigint64 => Codec::BigInt(BigIntKind::I64),
            Self::Biguint64 => Codec::BigInt(BigIntKind::U64),
            Self::Float32 => Codec::Float(FloatKind::F32),
            Self::Float64 => Codec::Float(FloatKind::F64),
            Self::Boolean => Codec::Boolean(BooleanDescriptor),
            Self::Unichar => Codec::Unichar(UnicharDescriptor),
            Self::Void => Codec::Void(VoidDescriptor),
            Self::Buffer => Codec::Buffer(BufferDescriptor),
            Self::Enum {
                shared_library,
                get_type_fn,
                signed,
            } => Self::enum_flags(EnumFlagsKind::Enum, shared_library, get_type_fn, signed),
            Self::Flags {
                shared_library,
                get_type_fn,
                signed,
            } => Self::enum_flags(EnumFlagsKind::Flags, shared_library, get_type_fn, signed),
            compound => return compound.into_compound_codec(),
        })
    }

    fn into_compound_codec(self) -> napi::Result<Codec> {
        Ok(match self {
            Self::String { ownership, length } => Codec::String(StringDescriptor {
                ownership: parse_ownership(&ownership)?,
                length: length.map(|n| n as usize),
            }),
            Self::Object { ownership } => Codec::Object(ObjectDescriptor {
                ownership: parse_ownership(&ownership)?,
            }),
            Self::Boxed {
                ownership,
                type_name,
                shared_library,
                get_type_fn,
                free_fn,
                caller_allocated,
            } => Codec::Boxed(BoxedDescriptor {
                ownership: parse_ownership(&ownership)?,
                type_name,
                shared_library,
                get_type_fn,
                free_fn,
                caller_allocated: caller_allocated.unwrap_or(false),
            }),
            Self::Struct {
                ownership,
                size,
                caller_allocated,
            } => Codec::Struct(StructDescriptor {
                ownership: parse_ownership(&ownership)?,
                size: size.map(|n| n as usize),
                caller_allocated: caller_allocated.unwrap_or(false),
            }),
            Self::Fundamental {
                ownership,
                shared_library,
                ref_fn,
                unref_fn,
                type_name,
            } => Codec::Fundamental(FundamentalDescriptor {
                ownership: parse_ownership(&ownership)?,
                shared_library,
                ref_func: ref_fn,
                unref_func: unref_fn,
                type_name,
            }),
            Self::Array {
                item_descriptor,
                array_kind,
                ownership,
                element_size,
                size_param_index,
                fixed_size,
            } => Codec::Array(ArrayDescriptor {
                item_descriptor: item_descriptor.into_codec()?,
                kind: Self::array_kind(&array_kind, size_param_index, fixed_size)?,
                ownership: parse_ownership(&ownership)?,
                element_size: element_size.map(|n| n as usize),
            }),
            Self::Hashtable {
                key_descriptor,
                value_descriptor,
                ownership,
            } => Codec::HashTable(HashTableDescriptor {
                key_descriptor: key_descriptor.into_codec()?,
                value_descriptor: value_descriptor.into_codec()?,
                ownership: parse_ownership(&ownership)?,
            }),
            Self::Callback {
                arg_descriptors,
                return_descriptor,
                has_destroy,
                user_data_index,
                scope,
            } => {
                let has_destroy = has_destroy.unwrap_or(false);
                Codec::Callback(CallbackDescriptor {
                    arg_descriptors: arg_descriptors
                        .into_iter()
                        .map(Self::into_codec)
                        .collect::<napi::Result<Vec<_>>>()?,
                    return_descriptor: return_descriptor.into_codec()?,
                    has_destroy,
                    user_data_index: user_data_index.map(|n| n as usize),
                    scope: Self::callback_scope(scope, has_destroy)?,
                })
            }
            Self::Ref {
                inner_descriptor,
                inout: _,
            } => Codec::Ref(RefDescriptor::new(*inner_descriptor.into_codec()?)?),
            _ => unreachable!("scalar and enum/flags variants are handled by into_codec"),
        })
    }

    fn enum_flags(
        kind: EnumFlagsKind,
        shared_library: String,
        get_type_fn: String,
        signed: bool,
    ) -> Codec {
        Codec::EnumFlags(EnumFlagsDescriptor {
            kind,
            shared_library,
            get_type_fn,
            storage: if signed {
                IntegerKind::I32
            } else {
                IntegerKind::U32
            },
        })
    }

    fn array_kind(
        array_kind: &str,
        size_param_index: Option<u32>,
        fixed_size: Option<u32>,
    ) -> napi::Result<ArrayKind> {
        let kind = array_kind.parse::<ArrayKind>().map_err(invalid_arg)?;
        Ok(match kind {
            ArrayKind::Sized { .. } => ArrayKind::Sized {
                size_index: size_param_index.ok_or_else(|| {
                    invalid_arg("'sizeParamIndex' is required for sized arrays".to_owned())
                })? as usize,
            },
            ArrayKind::Fixed { .. } => ArrayKind::Fixed {
                size: fixed_size.ok_or_else(|| {
                    invalid_arg("'fixedSize' is required for fixed arrays".to_owned())
                })? as usize,
            },
            other => other,
        })
    }

    fn callback_scope(scope: Option<String>, has_destroy: bool) -> napi::Result<CallbackScope> {
        match scope {
            Some(scope) => scope.parse().map_err(invalid_arg),
            None if has_destroy => Ok(CallbackScope::Notified),
            None => Ok(CallbackScope::Call),
        }
    }
}
