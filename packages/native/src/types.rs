//! FFI type system for describing GTK and `GLib` types.
//!
//! This module defines the [`Type`] enum and associated types that describe
//! all values that can flow through the FFI boundary. Types are parsed from
//! JavaScript objects and converted to libffi types for native calls.
//!
//! ## Type Hierarchy
//!
//! ```text
//! Type
//! ├── Integer(IntegerKind)    - Sized integers (i8..i64, u8..u64)
//! ├── Float(FloatKind)        - Floating point (f32, f64)
//! ├── String(StringType)      - UTF-8 strings (owned or borrowed)
//! ├── Boolean                 - Boolean values
//! ├── Null / Undefined        - Null pointer / void return
//! ├── GObject(GObjectType)    - GObject instances
//! ├── Boxed(BoxedType)        - GObject boxed types (e.g., GdkRGBA)
//! ├── Fundamental(FundamentalType) - Fundamental types (GVariant, GParamSpec, etc.)
//! ├── Array(ArrayType)        - Arrays, GLists, GSLists
//! ├── Callback(CallbackType)  - JavaScript callback functions
//! └── Ref(RefType)            - Pointers to values (out parameters)
//! ```
//!
//! ## Ownership
//!
//! Many types have an `ownership` field using the [`Ownership`] enum:
//! - **`Ownership::Full`**: Caller takes ownership, responsible for freeing
//! - **`Ownership::Borrowed`**: Caller receives a reference, must not free
//!
//! This is critical for correct memory management across the FFI boundary.
//!
//! [`Ownership`]: Ownership

use std::ffi::c_void;

use anyhow::bail;
use enum_dispatch::enum_dispatch;
use gtk4::glib;
use libffi::middle as libffi;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::{ffi, value};

/// Shared parser for the `argTypes` and `returnType` properties used by both
/// `CallbackType` and `TrampolineType`. Returns the parsed argument types and
/// return type or returns a JS type error referencing `kind` (e.g. `"callback"`).
pub(crate) fn parse_callback_arg_and_return_types(
    env: &Env,
    obj: &JsObject,
    kind: &str,
) -> napi::Result<(Vec<Type>, Box<Type>)> {
    let arg_types_prop: Unknown<'_> = obj.get_named_property("argTypes")?;
    if !arg_types_prop.is_array()? {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("'argTypes' property is required for {kind} types"),
        ));
    }
    let arg_types_arr: Array = unsafe { Array::from_napi_value(env.raw(), arg_types_prop.raw())? };
    let arr_len = arg_types_arr.len();
    let mut arg_types = Vec::with_capacity(arr_len as usize);
    for i in 0..arr_len {
        let item: Unknown<'_> = arg_types_arr.get(i)?.ok_or_else(|| {
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("'argTypes[{i}]' missing"),
            )
        })?;
        arg_types.push(Type::from_js_value(env, item)?);
    }

    let return_type_prop: Unknown<'_> = obj.get_named_property("returnType")?;
    let return_type = Box::new(Type::from_js_value(env, return_type_prop).map_err(|_| {
        napi::Error::new(
            napi::Status::InvalidArg,
            format!("'returnType' property is required for {kind} types"),
        )
    })?);

    Ok((arg_types, return_type))
}

mod array;
mod boolean;
mod boxed;
mod callback;
mod fundamental;
mod gobject;
mod hashtable;
mod numeric;
mod ref_type;
mod string;
mod trampoline;
mod unichar;
mod void;

pub use array::ArrayKind;
pub use array::ArrayType;
pub use boolean::BooleanType;
pub use boxed::{BoxedType, StructType};
pub use callback::CallbackType;
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::{HashTableEntryEncoder, HashTableType};
pub use numeric::{EnumType, FlagsType, FloatKind, IntegerKind, TaggedType};
pub use ref_type::RefType;
pub use string::StringType;
pub use trampoline::TrampolineType;
pub use unichar::UnicharType;
pub use void::VoidType;

#[derive(Debug, Clone, Copy, Default)]
#[non_exhaustive]
pub enum Ownership {
    #[default]
    Borrowed,
    Full,
}

impl Ownership {
    #[inline]
    #[must_use]
    pub fn is_full(self) -> bool {
        matches!(self, Self::Full)
    }

    #[inline]
    #[must_use]
    pub fn is_borrowed(self) -> bool {
        matches!(self, Self::Borrowed)
    }
}

impl Ownership {
    pub fn from_js_value(obj: &JsObject, type_name: &str) -> napi::Result<Self> {
        let missing = || {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("'ownership' property is required for {type_name} types"),
            )
        };

        let ownership = obj
            .get_named_property::<Option<String>>("ownership")
            .map_err(|_| missing())?
            .ok_or_else(missing)?;

        ownership
            .parse()
            .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))
    }
}

impl std::fmt::Display for Ownership {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Borrowed => write!(f, "borrowed"),
            Self::Full => write!(f, "full"),
        }
    }
}

impl std::str::FromStr for Ownership {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "full" => Ok(Self::Full),
            "borrowed" => Ok(Self::Borrowed),
            other => Err(format!(
                "'ownership' must be 'full' or 'borrowed', got '{other}'"
            )),
        }
    }
}

#[enum_dispatch]
pub trait FfiEncoder {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue>;

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::pointer()
    }

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(self.libffi_type());
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }
}

#[enum_dispatch]
pub trait FfiDecoder {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let _ = ffi_value;
        bail!("This type cannot be decoded from FfiValue")
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        _ffi_args: &[ffi::FfiValue],
        _args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(ffi_value)
    }
}

#[enum_dispatch]
pub trait RawPtrCodec {
    /// Reads a value from a `*const T**` (a pointer-to-pointer location), by
    /// dereferencing once and delegating to [`ptr_to_value`]. Pointer-typed
    /// codecs (string/gobject/boxed/struct/fundamental) inherit this default;
    /// scalar codecs override with a direct read.
    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let _ = value;
        unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
    }

    fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        let _ = (ptr, context);
        bail!("This type cannot be read from pointer")
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let _ = (ptr, value);
        bail!("This type cannot be written to a raw pointer")
    }
}

#[enum_dispatch]
#[allow(clippy::wrong_self_convention)]
pub trait GlibValueCodec {
    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let _ = gvalue;
        bail!("This type does not support GLib value conversion")
    }

    fn to_glib_value(&self, val: &value::Value) -> anyhow::Result<Option<glib::Value>> {
        let _ = val;
        Ok(None)
    }
}

pub trait FfiCodec: FfiEncoder + FfiDecoder + RawPtrCodec + GlibValueCodec {}
impl<T: FfiEncoder + FfiDecoder + RawPtrCodec + GlibValueCodec> FfiCodec for T {}

#[enum_dispatch(FfiEncoder, FfiDecoder, RawPtrCodec, GlibValueCodec)]
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Type {
    Integer(IntegerKind),
    Float(FloatKind),
    Enum(EnumType),
    Flags(FlagsType),
    String(StringType),
    Void(VoidType),
    Boolean(BooleanType),
    GObject(GObjectType),
    Boxed(BoxedType),
    Struct(StructType),
    Fundamental(FundamentalType),
    Array(ArrayType),
    HashTable(HashTableType),
    Callback(CallbackType),
    Trampoline(TrampolineType),
    Ref(RefType),
    Unichar(UnicharType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::Float(kind) => write!(f, "Float({kind:?})"),
            Self::Enum(t) => write!(f, "Enum({})", t.tagged.get_type_fn),
            Self::Flags(t) => write!(f, "Flags({})", t.tagged.get_type_fn),
            Self::String(_) => write!(f, "String"),
            Self::Void(_) => write!(f, "Void"),
            Self::Boolean(_) => write!(f, "Boolean"),
            Self::GObject(_) => write!(f, "GObject"),
            Self::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Self::Struct(t) => write!(f, "Struct({})", t.type_name),
            Self::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Self::Array(_) => write!(f, "Array"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Callback(_) => write!(f, "Callback"),
            Self::Trampoline(_) => write!(f, "Trampoline"),
            Self::Ref(t) => write!(f, "Ref({})", t.inner_type),
            Self::Unichar(_) => write!(f, "Unichar"),
        }
    }
}

impl Type {
    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let obj: JsObject = unsafe { JsObject::from_napi_value(env.raw(), value.raw())? };
        let ty: String = obj.get_named_property("type")?;

        match ty.as_str() {
            "int8" => Ok(Self::Integer(IntegerKind::I8)),
            "uint8" => Ok(Self::Integer(IntegerKind::U8)),
            "int16" => Ok(Self::Integer(IntegerKind::I16)),
            "uint16" => Ok(Self::Integer(IntegerKind::U16)),
            "int32" => Ok(Self::Integer(IntegerKind::I32)),
            "uint32" => Ok(Self::Integer(IntegerKind::U32)),
            "int64" => Ok(Self::Integer(IntegerKind::I64)),
            "uint64" => Ok(Self::Integer(IntegerKind::U64)),
            "float32" => Ok(Self::Float(FloatKind::F32)),
            "float64" => Ok(Self::Float(FloatKind::F64)),
            "enum" => Ok(Self::Enum(EnumType::from_js_value(env, &obj)?)),
            "flags" => Ok(Self::Flags(FlagsType::from_js_value(env, &obj)?)),
            "string" => Ok(Self::String(StringType::from_js_value(env, &obj)?)),
            "boolean" => Ok(Self::Boolean(BooleanType)),
            "void" => Ok(Self::Void(VoidType)),
            "gobject" => Ok(Self::GObject(GObjectType::from_js_value(env, &obj)?)),
            "boxed" => Ok(Self::Boxed(BoxedType::from_js_value(env, &obj)?)),
            "struct" => Ok(Self::Struct(StructType::from_js_value(env, &obj)?)),
            "array" => Ok(Self::Array(ArrayType::from_js_value(env, &obj)?)),
            "hashtable" => Ok(Self::HashTable(HashTableType::from_js_value(env, &obj)?)),
            "callback" => Ok(Self::Callback(CallbackType::from_js_value(env, &obj)?)),
            "trampoline" => Ok(Self::Trampoline(TrampolineType::from_js_value(env, &obj)?)),
            "ref" => Ok(Self::Ref(RefType::from_js_value(env, &obj)?)),
            "unichar" => Ok(Self::Unichar(UnicharType)),
            "fundamental" => Ok(Self::Fundamental(FundamentalType::from_js_value(
                env, &obj,
            )?)),
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unknown type: {other}"),
            )),
        }
    }
}
