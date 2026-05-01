//! FFI type system for describing GTK and GLib types.
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
use neon::prelude::*;

use crate::{ffi, value};

mod sealed {
    pub trait Sealed {}
    impl Sealed for neon::prelude::FunctionContext<'_> {}
}

pub(crate) trait NeonContextExt: sealed::Sealed {
    fn throw_str_error(&mut self, msg: String) -> neon::result::Throw;
}

impl NeonContextExt for FunctionContext<'_> {
    fn throw_str_error(&mut self, msg: String) -> neon::result::Throw {
        self.throw_type_error::<_, ()>(msg).unwrap_err()
    }
}

/// Shared parser for the `argTypes` and `returnType` properties used by both
/// `CallbackType` and `TrampolineType`. Returns the parsed argument types and
/// return type or throws a JS type error referencing `kind` (e.g. `"callback"`).
pub(crate) fn parse_callback_arg_and_return_types(
    cx: &mut FunctionContext,
    obj: Handle<JsObject>,
    kind: &str,
) -> NeonResult<(Vec<Type>, Box<Type>)> {
    let arg_types_prop: Handle<'_, JsValue> = obj.prop(cx, "argTypes").get()?;
    let arg_types_arr = arg_types_prop.downcast::<JsArray, _>(cx).or_else(|_| {
        cx.throw_type_error(format!("'argTypes' property is required for {kind} types"))
    })?;
    let arg_types_vec = arg_types_arr.to_vec(cx)?;
    let mut arg_types = Vec::with_capacity(arg_types_vec.len());
    for item in arg_types_vec {
        arg_types.push(Type::from_js_value(cx, item)?);
    }

    let return_type_prop: Handle<'_, JsValue> = obj.prop(cx, "returnType").get()?;
    let return_type = Box::new(Type::from_js_value(cx, return_type_prop).or_else(|_| {
        cx.throw_type_error(format!(
            "'returnType' property is required for {kind} types"
        ))
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
        matches!(self, Ownership::Full)
    }

    #[inline]
    #[must_use]
    pub fn is_borrowed(self) -> bool {
        matches!(self, Ownership::Borrowed)
    }
}

impl Ownership {
    pub fn from_js_value(
        cx: &mut FunctionContext,
        obj: Handle<JsObject>,
        type_name: &str,
    ) -> NeonResult<Self> {
        let ownership_prop: Handle<'_, JsValue> = obj.prop(cx, "ownership").get()?;

        let ownership = ownership_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| {
                cx.throw_type_error(format!(
                    "'ownership' property is required for {} types",
                    type_name
                ))
            })?
            .value(cx);

        ownership.parse().map_err(|e: String| cx.throw_str_error(e))
    }
}

impl std::fmt::Display for Ownership {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Ownership::Borrowed => write!(f, "borrowed"),
            Ownership::Full => write!(f, "full"),
        }
    }
}

impl std::str::FromStr for Ownership {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "full" => Ok(Ownership::Full),
            "borrowed" => Ok(Ownership::Borrowed),
            other => Err(format!(
                "'ownership' must be 'full' or 'borrowed', got '{}'",
                other
            )),
        }
    }
}

#[enum_dispatch]
#[allow(clippy::wrong_self_convention)]
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

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
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
            Type::Integer(kind) => write!(f, "Integer({:?})", kind),
            Type::Float(kind) => write!(f, "Float({:?})", kind),
            Type::Enum(t) => write!(f, "Enum({})", t.tagged.get_type_fn),
            Type::Flags(t) => write!(f, "Flags({})", t.tagged.get_type_fn),
            Type::String(_) => write!(f, "String"),
            Type::Void(_) => write!(f, "Void"),
            Type::Boolean(_) => write!(f, "Boolean"),
            Type::GObject(_) => write!(f, "GObject"),
            Type::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Type::Struct(t) => write!(f, "Struct({})", t.type_name),
            Type::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Type::Array(_) => write!(f, "Array"),
            Type::HashTable(_) => write!(f, "HashTable"),
            Type::Callback(_) => write!(f, "Callback"),
            Type::Trampoline(_) => write!(f, "Trampoline"),
            Type::Ref(t) => write!(f, "Ref({})", t.inner_type),
            Type::Unichar(_) => write!(f, "Unichar"),
        }
    }
}

impl Type {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let type_value: Handle<'_, JsValue> = obj.prop(cx, "type").get()?;

        let ty = type_value
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        match ty.as_str() {
            "int8" => Ok(Type::Integer(IntegerKind::I8)),
            "uint8" => Ok(Type::Integer(IntegerKind::U8)),
            "int16" => Ok(Type::Integer(IntegerKind::I16)),
            "uint16" => Ok(Type::Integer(IntegerKind::U16)),
            "int32" => Ok(Type::Integer(IntegerKind::I32)),
            "uint32" => Ok(Type::Integer(IntegerKind::U32)),
            "int64" => Ok(Type::Integer(IntegerKind::I64)),
            "uint64" => Ok(Type::Integer(IntegerKind::U64)),
            "float32" => Ok(Type::Float(FloatKind::F32)),
            "float64" => Ok(Type::Float(FloatKind::F64)),
            "enum" => Ok(Type::Enum(EnumType::from_js_value(cx, value)?)),
            "flags" => Ok(Type::Flags(FlagsType::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean(BooleanType)),
            "void" => Ok(Type::Void(VoidType)),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "hashtable" => Ok(Type::HashTable(HashTableType::from_js_value(cx, value)?)),
            "callback" => Ok(Type::Callback(CallbackType::from_js_value(cx, value)?)),
            "trampoline" => Ok(Type::Trampoline(TrampolineType::from_js_value(cx, value)?)),
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            "unichar" => Ok(Type::Unichar(UnicharType)),
            "fundamental" => Ok(Type::Fundamental(FundamentalType::from_js_value(
                cx, value,
            )?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", ty)),
        }
    }
}
