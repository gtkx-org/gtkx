use std::cell::Cell;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{
    ArrayBounds, ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, BoxedCodec, BufferCodec,
    CallbackCodec, CallbackReleasePolicy, CallbackScope, Codec, DestroyNotifyKind, EnumFlagsCodec,
    EnumFlagsKind, FloatCodec, FundamentalCodec, HashTableCodec, IntegerCodec, ObjectCodec,
    Ownership, RefCodec, StringCodec, StructCodec, UnicharCodec, VoidCodec,
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
        /// Member values of an enumeration with no registered `GType`, which the GIR is the only
        /// source of. `None` leaves the membership check to the `GType`'s `GEnumClass`.
        members: Option<Vec<i32>>,
    },
    Flags {
        shared_library: String,
        get_type_fn_name: String,
        is_signed: bool,
        mask: Option<u32>,
    },
    Boolean,
    String {
        ownership: Ownership,
        length: Option<i64>,
        /// Whether the instance holding the slot owns the string in it, so that a write releases
        /// what it displaces. Set only on record fields GIR spells as a non-`const` `char *`.
        has_owned_storage: Option<bool>,
    },
    Object {
        ownership: Ownership,
        is_call_scoped: Option<bool>,
        /// `GType` name of the declared type, which an argument's instance must be one of.
        type_name: Option<String>,
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
        shared_library: Option<String>,
        copy_fn_name: Option<String>,
        free_fn_name: Option<String>,
    },
    Fundamental {
        ownership: Ownership,
        shared_library: String,
        ref_fn_name: String,
        unref_fn_name: String,
        type_name: Option<String>,
        is_caller_allocated: Option<bool>,
        is_inline: Option<bool>,
    },
    Array {
        #[napi(ts_type = "Descriptor")]
        item_descriptor: NestedDescriptor,
        array_kind: ArrayKind,
        ownership: Ownership,
        base_param_index: Option<u32>,
        size_param_index: Option<u32>,
        fixed_size: Option<u32>,
        element_size: Option<u32>,
        is_bytes: Option<bool>,
        is_caller_allocated: Option<bool>,
        is_zero_terminated: Option<bool>,
        preserve_null: Option<bool>,
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
        destroy_kind: Option<DestroyNotifyKind>,
        has_user_data: Option<bool>,
        user_data_index: Option<u32>,
        can_throw: Option<bool>,
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
                members,
            } => Self::enum_flags(
                EnumFlagsKind::Enum,
                shared_library,
                get_type_fn_name,
                is_signed,
                None,
                members,
            ),
            Self::Flags {
                shared_library,
                get_type_fn_name,
                is_signed,
                mask,
            } => Self::enum_flags(
                EnumFlagsKind::Flags,
                shared_library,
                get_type_fn_name,
                is_signed,
                mask,
                None,
            ),
            Self::String {
                ownership,
                length,
                has_owned_storage,
            } => Codec::String(StringCodec {
                ownership,
                length: string_length(length)?,
                has_owned_storage: has_owned_storage.unwrap_or(false),
            }),
            Self::Object {
                ownership,
                is_call_scoped,
                type_name,
            } => Codec::Object(ObjectCodec::new(
                ownership,
                is_call_scoped.unwrap_or(false),
                type_name,
            )),
            other => other.into_instance_codec()?,
        })
    }

    /// Builds the codec of a descriptor whose value is an instance somebody owns, which the
    /// descriptor names the copy and release functions of.
    fn into_instance_codec(self) -> Result<Codec> {
        Ok(match self {
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
                shared_library,
                copy_fn_name,
                free_fn_name,
            } => Codec::Struct(StructCodec {
                ownership,
                size: size.map(|n| n as usize),
                caller_allocated: is_caller_allocated.unwrap_or(false),
                inline: is_inline.unwrap_or(false),
                shared_library,
                copy_fn_name,
                free_fn_name,
            }),
            Self::Fundamental {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
                type_name: _,
                is_caller_allocated,
                is_inline,
            } => Codec::Fundamental(FundamentalCodec {
                ownership,
                shared_library,
                ref_fn_name,
                unref_fn_name,
                caller_allocated: is_caller_allocated.unwrap_or(false),
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
                base_param_index,
                size_param_index,
                fixed_size,
                element_size,
                is_bytes,
                is_caller_allocated,
                is_zero_terminated,
                preserve_null,
            } => {
                let mut codec = ArrayCodec::new(
                    item_descriptor.into_codec()?,
                    array_kind,
                    ownership,
                    ArrayBounds {
                        base_param_index,
                        size_param_index,
                        fixed_size,
                    },
                    element_size.map(|n| n as usize),
                    is_bytes.unwrap_or(false),
                    preserve_null.unwrap_or(false),
                )
                .map_err(|error| Error::from_reason(error.to_string()))?;
                if is_zero_terminated.unwrap_or(false) {
                    codec = codec.zero_terminated();
                }
                if is_caller_allocated.unwrap_or(false) {
                    codec = codec
                        .caller_allocated()
                        .map_err(|error| Error::from_reason(error.to_string()))?;
                }
                Codec::Array(codec)
            }
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
                destroy_kind,
                has_user_data,
                user_data_index,
                can_throw,
                scope,
            } => {
                let has_destroy = has_destroy.unwrap_or(false);
                let has_user_data = has_user_data.unwrap_or(false);
                let release_policy = if matches!(scope.as_ref(), Some(CallbackScope::Notified))
                    && !has_destroy
                    && has_user_data
                {
                    CallbackReleasePolicy::AsyncCompletion
                } else {
                    CallbackReleasePolicy::Scope
                };
                Codec::Callback(CallbackCodec {
                    arg_codecs: arg_descriptors
                        .0
                        .into_iter()
                        .map(Self::into_codec)
                        .collect::<Result<Vec<_>>>()?,
                    return_codec: return_descriptor.into_codec()?,
                    has_destroy,
                    destroy_kind: destroy_kind.unwrap_or_default(),
                    has_user_data,
                    user_data_index: user_data_index.map(|n| n as usize),
                    can_throw: can_throw.unwrap_or(false),
                    scope: Self::callback_scope(scope, has_destroy, has_user_data),
                    release_policy,
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
        mask: Option<u32>,
        members: Option<Vec<i32>>,
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
            mask,
            members,
        })
    }

    fn callback_scope(
        scope: Option<CallbackScope>,
        has_destroy: bool,
        has_user_data: bool,
    ) -> CallbackScope {
        match scope {
            Some(CallbackScope::Notified) if !has_destroy => CallbackScope::Forever,
            Some(scope) => scope,
            None if !has_user_data && !has_destroy => CallbackScope::Forever,
            None if has_destroy => CallbackScope::Notified,
            None => CallbackScope::Call,
        }
    }
}
